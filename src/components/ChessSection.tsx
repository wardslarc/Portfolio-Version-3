"use client";

import { Chess, type Move, type Square } from "chess.js";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type GameStatus = "active" | "checkmate" | "stalemate" | "draw";

interface PublicChessMove {
  ply: number;
  san: string;
  from: string;
  to: string;
  city: string | null;
  country: string | null;
  playedAt: string;
  isYou: boolean;
}

interface ChessYouState {
  canMove: boolean;
  nextMoveAt: string | null;
  lockedBy: "you" | "network" | null;
}

interface ChessPayload {
  game: {
    number: number;
    status: GameStatus;
    result: "1-0" | "0-1" | "1/2-1/2" | null;
    fen: string;
    version: number;
    startedAt: string;
    moves: PublicChessMove[];
  };
  visitors: number;
  you: ChessYouState;
  serverNow: string;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

const PIECE_NAME: Record<string, string> = {
  k: "king",
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
  p: "pawn",
};

const POLL_INTERVAL_MS = 45_000;
const COUNTDOWN_TICK_MS = 30_000;

function pieceSrc(type: string, color: "w" | "b"): string {
  return `/chess/Chess_${type}${color === "w" ? "l" : "d"}t45.svg`;
}

function formatPlace(city: string | null, country: string | null): string {
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  return "Visitor";
}

function formatAvatarInitials(move: PublicChessMove): string {
  if (move.isYou) return "You";
  const place = formatPlace(move.city, move.country);
  const words = place.split(",")[0]?.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials = words.map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return initials || "V";
}

function formatAgo(playedAtIso: string, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(playedAtIso).getTime()) / 1000));
  if (diffSec < 60) return "now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

function formatCountdown(nextMoveAtIso: string, nowMs: number): string {
  const leftMs = Math.max(0, new Date(nextMoveAtIso).getTime() - nowMs);
  const hours = Math.floor(leftMs / 3_600_000);
  const mins = Math.floor((leftMs % 3_600_000) / 60_000);
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

function moveNumberPrefix(indexZeroBased: number): string {
  return `${Math.floor(indexZeroBased / 2) + 1}${indexZeroBased % 2 ? "…" : "."}`;
}

export default function ChessSection() {
  const [data, setData] = useState<ChessPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [animTo, setAnimTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [justPlayedSan, setJustPlayedSan] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string>("");
  const [toastOpen, setToastOpen] = useState(false);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [nowTick, setNowTick] = useState(0);

  const sectionRef = useRef<HTMLElement>(null);
  const movesBoxRef = useRef<HTMLDivElement>(null);
  const etagRef = useRef<string | null>(null);
  const isVisibleRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFailedMoveRef = useRef<{
    version: number;
    from: string;
    to: string;
    moveId: string;
  } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastOpen(false);
    }, 2800);
  }, []);

  const applyServerPayload = useCallback((payload: ChessPayload, etagHeader: string | null) => {
    setData(payload);
    setLoadError(null);
    setClockOffsetMs(new Date(payload.serverNow).getTime() - Date.now());
    setNowTick(Date.now());
    if (etagHeader) {
      etagRef.current = etagHeader;
    } else {
      etagRef.current = `"g${payload.game.number}-v${payload.game.version}"`;
    }
  }, []);

  const fetchBoard = useCallback(
    async (conditional = false) => {
      try {
        const headers: Record<string, string> = {};
        if (conditional && etagRef.current) {
          headers["If-None-Match"] = etagRef.current;
        }
        const res = await fetch("/api/chess", { headers, cache: "no-store" });
        if (res.status === 304) {
          setNowTick(Date.now());
          return;
        }
        const body = (await res.json().catch(() => null)) as (ChessPayload & { error?: string }) | null;
        if (!res.ok || !body?.game) {
          setLoadError(body?.error ?? "Visitor chess isn't available right now.");
          return;
        }
        applyServerPayload(body, res.headers.get("etag"));
      } catch {
        setLoadError((prev) => prev ?? "Unable to reach the server.");
      }
    },
    [applyServerPayload],
  );

  // Initial load
  useEffect(() => {
    const id = setTimeout(() => {
      void fetchBoard(false);
    }, 0);
    return () => clearTimeout(id);
  }, [fetchBoard]);

  // IntersectionObserver + visibilitychange + 45s poll
  useEffect(() => {
    const sectionEl = sectionRef.current;
    if (!sectionEl) return;

    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const syncPolling = () => {
      const active = isVisibleRef.current && document.visibilityState === "visible";
      if (active && !pollTimer) {
        pollTimer = setInterval(() => {
          void fetchBoard(true);
        }, POLL_INTERVAL_MS);
      } else if (!active && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        const becameVisible = visible && !isVisibleRef.current;
        isVisibleRef.current = visible;
        if (becameVisible && document.visibilityState === "visible") {
          void fetchBoard(true);
        }
        syncPolling();
      },
      { threshold: 0.05 },
    );
    observer.observe(sectionEl);

    const onVisChange = () => {
      if (document.visibilityState === "visible" && isVisibleRef.current) {
        void fetchBoard(true);
      }
      syncPolling();
    };
    document.addEventListener("visibilitychange", onVisChange);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisChange);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [fetchBoard]);

  // Countdown tick every 30s while locked. Polls send If-None-Match and get 304 while the board
  // is unchanged, so when the cooldown runs out, fetch unconditionally to pick up canMove again.
  useEffect(() => {
    if (!data || data.you.canMove || !data.you.nextMoveAt) return;
    const unlockAt = new Date(data.you.nextMoveAt).getTime();
    const timer = setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      if (now + clockOffsetMs >= unlockAt) void fetchBoard(false);
    }, COUNTDOWN_TICK_MS);
    return () => clearInterval(timer);
  }, [data, clockOffsetMs, fetchBoard]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Build live Chess instance and display Chess instance (either live or replayed up to viewPly)
  const { liveChess, displayChess } = useMemo(() => {
    const live = new Chess();
    if (data?.game.moves) {
      for (const m of data.game.moves) {
        try {
          live.move(m.san);
        } catch {
          if (data.game.fen) live.load(data.game.fen);
          break;
        }
      }
    }
    if (viewPly === null || !data) {
      return { liveChess: live, displayChess: live };
    }
    const clamped = Math.max(0, Math.min(viewPly, data.game.moves.length));
    const hist = new Chess();
    for (let i = 0; i < clamped; i++) {
      try {
        hist.move(data.game.moves[i]!.san);
      } catch {
        break;
      }
    }
    return { liveChess: live, displayChess: hist };
  }, [data, viewPly]);

  const moves = data?.game.moves ?? [];
  const isGameOver = data ? data.game.status !== "active" : false;
  const canInteract = Boolean(data && data.you.canMove && !isGameOver && viewPly === null && !pending);
  const currentPly = viewPly === null ? moves.length : viewPly;

  const goToPly = useCallback(
    (ply: number | null) => {
      setSelected(null);
      if (ply === null || ply >= moves.length) {
        setViewPly(null);
      } else {
        setViewPly(Math.max(0, ply));
      }
    },
    [moves.length],
  );

  // Keyboard navigation: ← and → only while section is in viewport and not inside form fields
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, select, [contenteditable]")) return;
      const sec = sectionRef.current;
      if (!sec) return;
      const rect = sec.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;

      if (e.key === "ArrowLeft" && currentPly > 0) {
        e.preventDefault();
        goToPly(currentPly - 1);
      } else if (e.key === "ArrowRight" && currentPly < moves.length) {
        e.preventDefault();
        goToPly(currentPly + 1);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [currentPly, goToPly, moves.length]);

  // Keep active move row visible inside the move list scroll container without scrolling the window
  useEffect(() => {
    const box = movesBoxRef.current;
    if (!box) return;
    const cur = box.querySelector<HTMLElement>(".mv.cur");
    if (!cur) return;
    const top = cur.offsetTop;
    const bottom = top + cur.offsetHeight;
    if (top < box.scrollTop) {
      box.scrollTop = top - 6;
    } else if (bottom > box.scrollTop + box.clientHeight) {
      box.scrollTop = bottom - box.clientHeight + 6;
    }
  }, [currentPly, moves.length]);

  const legalTargets = useMemo(() => {
    const map = new Map<Square, Move>();
    if (!selected || !canInteract) return map;
    for (const m of liveChess.moves({ square: selected, verbose: true })) {
      map.set(m.to, m);
    }
    return map;
  }, [selected, canInteract, liveChess]);

  const checkSquare = useMemo(() => {
    if (!displayChess.inCheck()) return null;
    const turn = displayChess.turn();
    for (const r of RANKS) {
      for (const f of FILES) {
        const sq = `${f}${r}` as Square;
        const p = displayChess.get(sq);
        if (p && p.type === "k" && p.color === turn) return sq;
      }
    }
    return null;
  }, [displayChess]);

  const lastMoveShown = currentPly > 0 ? moves[currentPly - 1] : null;

  async function submitMove(from: Square, to: Square, promotion?: "q") {
    if (!data || pending) return;

    const prevSnapshot = data;
    const prevMoveCount = data.game.moves.length;
    const preview = new Chess();
    for (const m of data.game.moves) preview.move(m.san);

    let applied: Move;
    try {
      applied = preview.move({ from, to, promotion: promotion ?? "q" });
    } catch {
      showToast("That move isn't allowed.");
      return;
    }

    const reused =
      lastFailedMoveRef.current &&
      lastFailedMoveRef.current.version === data.game.version &&
      lastFailedMoveRef.current.from === from &&
      lastFailedMoveRef.current.to === to
        ? lastFailedMoveRef.current.moveId
        : crypto.randomUUID();

    const nowIso = new Date(Date.now() + clockOffsetMs).toISOString();
    const optimisticStatus: GameStatus = preview.isCheckmate()
      ? "checkmate"
      : preview.isStalemate()
        ? "stalemate"
        : preview.isDraw()
          ? "draw"
          : "active";
    const optimisticResult = preview.isCheckmate()
      ? applied.color === "w"
        ? "1-0"
        : "0-1"
      : preview.isDraw() || preview.isStalemate()
        ? "1/2-1/2"
        : null;

    // Optimistic update
    setSelected(null);
    setAnimTo(to);
    setPending(true);
    setJustPlayedSan(applied.san);
    setData({
      ...data,
      game: {
        ...data.game,
        status: optimisticStatus,
        result: optimisticResult,
        fen: preview.fen(),
        version: data.game.version + 1,
        moves: [
          ...data.game.moves,
          {
            ply: prevMoveCount + 1,
            san: applied.san,
            from: applied.from,
            to: applied.to,
            city: null,
            country: null,
            playedAt: nowIso,
            isYou: true,
          },
        ],
      },
      you: {
        canMove: false,
        nextMoveAt: new Date(Date.now() + clockOffsetMs + 86_400_000).toISOString(),
        lockedBy: "you",
      },
    });

    try {
      const res = await fetch("/api/chess/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          ...(applied.isPromotion() ? { promotion: "q" as const } : {}),
          version: prevSnapshot.game.version,
          gameNumber: prevSnapshot.game.number,
          moveId: reused,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<ChessPayload> & {
        error?: string;
        nextMoveAt?: string | null;
        lockedBy?: "you" | "network" | null;
      };

      if (res.ok && body.game && body.you && body.serverNow) {
        lastFailedMoveRef.current = null;
        applyServerPayload(body as ChessPayload, null);
        if (body.game.status === "checkmate") {
          showToast(`Checkmate! ${applied.san} ends Game ${body.game.number}.`);
        } else if (body.game.status !== "active") {
          showToast(`${applied.san} ends Game ${body.game.number} in a draw.`);
        } else {
          showToast(`Move ${applied.san} saved. See you tomorrow.`);
        }
        return;
      }

      if (res.status === 409 && body.game && body.you && body.serverNow) {
        lastFailedMoveRef.current = null;
        setJustPlayedSan(null);
        setAnimTo(null);
        setViewPly(null);
        applyServerPayload(body as ChessPayload, null);
        showToast("Someone moved first. The board has been updated.");
        return;
      }

      if (res.status === 429) {
        lastFailedMoveRef.current = null;
        setJustPlayedSan(null);
        setAnimTo(null);
        setData({
          ...prevSnapshot,
          you: {
            canMove: false,
            nextMoveAt: body.nextMoveAt ?? prevSnapshot.you.nextMoveAt,
            lockedBy: body.lockedBy ?? "you",
          },
        });
        showToast(
          body.lockedBy === "network"
            ? "Someone on your network already moved today."
            : (body.error ?? "You already made a move today."),
        );
        return;
      }

      if (res.status === 400) {
        lastFailedMoveRef.current = null;
        setJustPlayedSan(null);
        setAnimTo(null);
        setData(prevSnapshot);
        showToast("That move isn't allowed.");
        return;
      }

      // 503 or other transient server failure: revert and retain moveId for retry
      lastFailedMoveRef.current = {
        version: prevSnapshot.game.version,
        from,
        to,
        moveId: reused,
      };
      setJustPlayedSan(null);
      setAnimTo(null);
      setData(prevSnapshot);
      showToast(body.error ?? "The board is busy, try again.");
    } catch {
      lastFailedMoveRef.current = {
        version: prevSnapshot.game.version,
        from,
        to,
        moveId: reused,
      };
      setJustPlayedSan(null);
      setAnimTo(null);
      setData(prevSnapshot);
      showToast("Network error. Tap the same move to retry.");
    } finally {
      setPending(false);
    }
  }

  function handleSquareClick(sq: Square) {
    if (!canInteract) return;
    const legal = legalTargets.get(sq);
    if (selected && legal) {
      void submitMove(selected, sq, legal.isPromotion() ? "q" : undefined);
      return;
    }
    const piece = liveChess.get(sq);
    if (piece && piece.color === liveChess.turn() && sq !== selected) {
      setSelected(sq);
    } else {
      setSelected(null);
    }
  }

  const serverNowMs =
    nowTick > 0 ? nowTick + clockOffsetMs : data ? new Date(data.serverNow).getTime() : 0;
  const turn = displayChess.turn();
  const statusExtra = displayChess.isCheckmate()
    ? "Checkmate"
    : displayChess.isStalemate()
      ? "Stalemate"
      : displayChess.isDraw()
        ? "Draw"
        : displayChess.inCheck()
          ? "Check"
          : "";

  let pillEl = <span className="cx-pill">Loading board…</span>;
  if (loadError && !data) {
    pillEl = <span className="cx-pill wait">Offline</span>;
  } else if (data) {
    if (viewPly !== null) {
      pillEl = <span className="cx-pill view">Viewing history</span>;
    } else if (isGameOver) {
      pillEl = (
        <span className="cx-pill wait">
          Game over · Game {data.game.number + 1} is ready
        </span>
      );
    } else if (!data.you.canMove && data.you.nextMoveAt) {
      pillEl = (
        <span className="cx-pill wait">
          Next move in {formatCountdown(data.you.nextMoveAt, serverNowMs)}
        </span>
      );
    } else {
      pillEl = <span className="cx-pill ok">Your move is available</span>;
    }
  }

  let hintText = "Tap a piece, then tap a highlighted square.";
  if (loadError && !data) {
    hintText = loadError;
  } else if (viewPly !== null) {
    hintText = "This is a past position. Go back to the live board to play.";
  } else if (isGameOver && data) {
    hintText = `Game ${data.game.number} is over. Game ${data.game.number + 1} starts on the next load.`;
  } else if (data && !data.you.canMove) {
    const myLast = [...moves].reverse().find((m) => m.isYou);
    if (justPlayedSan) {
      hintText = `You played ${justPlayedSan} today. Thanks for moving.`;
    } else if (data.you.lockedBy === "network") {
      hintText = "Someone on your network already moved today.";
    } else if (myLast) {
      hintText = `You played ${myLast.san} today. Thanks for moving.`;
    } else {
      hintText = "You already moved today. Come back after the cooldown.";
    }
  }

  const latestMove = moves.length > 0 ? moves[moves.length - 1]! : null;
  const viewedMove = viewPly !== null && viewPly > 0 ? moves[viewPly - 1] : null;
  const viewedPlace = viewedMove ? formatPlace(viewedMove.city, viewedMove.country) : "";

  return (
    <section id="chess" ref={sectionRef} aria-labelledby="chess-h">
      <div className="cx-head">
        <h2 className="section-label" id="chess-h">
          {data ? `Visitor chess · Game ${data.game.number}` : "Visitor chess"}
        </h2>
        <h3>Make the next move</h3>
        <p>
          Everyone who visits this site plays the same game. You get one move a day, for whichever
          side is up. Come back tomorrow to see what happened next.
        </p>
      </div>

      <div className="cx-grid">
        <div className="cx-boardcol">
          <div className="cx-top">
            <span className="cx-turn">
              <span className={`sw ${turn}`} aria-hidden="true" />
              {turn === "w" ? "White" : "Black"} to move
              {statusExtra ? <small> · {statusExtra}</small> : null}
            </span>
            {pillEl}
          </div>

          {viewPly !== null ? (
            <div className="cx-view">
              <span>
                {viewPly === 0 || !viewedMove
                  ? "Starting position"
                  : `After ${moveNumberPrefix(viewPly - 1)} ${viewedMove.san} · ${
                      viewedMove.isYou
                        ? "your move"
                        : viewedMove.city || viewedMove.country
                          ? `visitor from ${viewedPlace}`
                          : "visitor"
                    }`}
              </span>
              <button type="button" className="btn" onClick={() => goToPly(null)}>
                Back to live board
              </button>
            </div>
          ) : null}

          <div className="cx-frame">
            <div className="cx-board" role="group" aria-label="Chess board">
              {RANKS.map((rank) =>
                FILES.map((file, fileIdx) => {
                  const sq = `${file}${rank}` as Square;
                  const piece = displayChess.get(sq);
                  const isLight = (fileIdx + rank) % 2 === 1;
                  const isLast =
                    lastMoveShown !== null &&
                    (lastMoveShown.from === sq || lastMoveShown.to === sq);
                  const isSelected = selected === sq;
                  const isCheck = checkSquare === sq;
                  const legal = legalTargets.get(sq);
                  const canClick =
                    canInteract &&
                    Boolean((piece && piece.color === liveChess.turn()) || legal);

                  const labelParts: string[] = [sq];
                  if (piece) {
                    labelParts.push(
                      `${piece.color === "w" ? "white" : "black"} ${PIECE_NAME[piece.type]}`,
                    );
                  }
                  if (legal) labelParts.push("legal move");

                  const sqClasses = [
                    "sq",
                    isLight ? "l" : "d",
                    isLast ? "last" : "",
                    isSelected ? "sel" : "",
                    isCheck ? "check" : "",
                    canClick ? "can" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={sq}
                      type="button"
                      className={sqClasses}
                      onClick={() => handleSquareClick(sq)}
                      aria-label={labelParts.join(", ")}
                    >
                      {piece ? (
                        <Image
                          src={pieceSrc(piece.type, piece.color)}
                          alt=""
                          width={45}
                          height={45}
                          unoptimized
                          draggable={false}
                          aria-hidden="true"
                          className={`pc${animTo === sq ? " drop" : ""}`}
                        />
                      ) : null}
                      {legal ? (
                        <span
                          className={`hint${piece || legal.isEnPassant() ? " cap" : ""}`}
                          aria-hidden="true"
                        />
                      ) : null}
                      {fileIdx === 0 ? (
                        <span className="co r" aria-hidden="true">
                          {rank}
                        </span>
                      ) : null}
                      {rank === 1 ? (
                        <span className="co f" aria-hidden="true">
                          {file}
                        </span>
                      ) : null}
                    </button>
                  );
                }),
              )}
            </div>
          </div>

          <div className="cx-foot">
            <span>
              {hintText}
              {loadError && !data ? (
                <button type="button" className="cx-retry" onClick={() => void fetchBoard(false)}>
                  Retry
                </button>
              ) : null}
              {isGameOver && viewPly === null ? (
                <button type="button" className="cx-retry" onClick={() => void fetchBoard(false)}>
                  Load Game {data!.game.number + 1}
                </button>
              ) : null}
            </span>
            <span>
              <kbd>←</kbd> <kbd>→</kbd> step through moves
            </span>
          </div>
        </div>

        <aside className="cx-ledger" aria-label="Move history">
          <div className="cx-lhead">
            <b>Moves</b>
            <span>
              {data
                ? `${moves.length} ${moves.length === 1 ? "move" : "moves"} · ${data.visitors} ${
                    data.visitors === 1 ? "visitor" : "visitors"
                  }`
                : "Loading…"}
            </span>
          </div>

          <div className="cx-moves" ref={movesBoxRef}>
            {moves.map((m, idx) => {
              const num = moveNumberPrefix(idx);
              const ago = formatAgo(m.playedAt, serverNowMs);
              const place = formatPlace(m.city, m.country);
              const isCur = idx + 1 === currentPly;
              return (
                <button
                  key={`${m.ply}-${m.san}`}
                  type="button"
                  className={`mv${isCur ? " cur" : ""}${m.isYou ? " mine" : ""}`}
                  onClick={() => goToPly(idx + 1)}
                  aria-label={`Move ${num} ${m.san}, ${
                    m.isYou ? "your move" : `visitor from ${place}, ${ago} ago`
                  }`}
                >
                  <span className="n">{num}</span>
                  <span className="san">{m.san}</span>
                  <span className="ago">{ago}</span>
                  <span className="who">{m.isYou ? "You" : place}</span>
                </button>
              );
            })}
            {!isGameOver ? (
              <div className="mv next">
                <span className="n">{moveNumberPrefix(moves.length)}</span>
                <span className="san">…</span>
                <span />
                <span className="who">Waiting for the next visitor</span>
              </div>
            ) : null}
          </div>

          <div className="cx-last">
            {latestMove ? (
              <>
                <div className="cx-av" aria-hidden="true">
                  {formatAvatarInitials(latestMove)}
                </div>
                <div className="meta">
                  <b>
                    {latestMove.isYou
                      ? "You"
                      : formatPlace(latestMove.city, latestMove.country)}
                  </b>
                  <span>
                    {formatAgo(latestMove.playedAt, serverNowMs) === "now"
                      ? "Just now"
                      : `${formatAgo(latestMove.playedAt, serverNowMs)} ago`}
                  </span>
                </div>
                <div className="san">{latestMove.san}</div>
              </>
            ) : (
              <>
                <div className="cx-av" aria-hidden="true">
                  1.
                </div>
                <div className="meta">
                  <b>New game</b>
                  <span>Waiting for the opening move</span>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      <div className={`cx-toast${toastOpen ? " on" : ""}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </section>
  );
}
