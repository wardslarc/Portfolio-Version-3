"use client";

import { Chess } from "chess.js";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  clearChessCooldownAction,
  endChessGameAction,
  undoLastChessMoveAction,
} from "@/lib/admin/actions";
import type { AdminChessGame, AdminChessGameSummary } from "@/lib/admin/data";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

function pieceSrc(type: string, color: "w" | "b"): string {
  return `/chess/Chess_${type}${color === "w" ? "l" : "d"}t45.svg`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Date and time as separate unbreakable parts, so a narrow column wraps between them only.
function DateTimeParts({ iso }: { iso: string }) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return (
    <span>
      <span className="admin-nowrap">{date},</span> <span className="admin-nowrap">{time}</span>
    </span>
  );
}

export default function ChessAdminClient({
  game,
  activeGameNumber,
  games,
  canMutate,
}: {
  game: AdminChessGame | null;
  activeGameNumber: number | null;
  games: AdminChessGameSummary[];
  canMutate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const endDialogRef = useRef<HTMLDialogElement>(null);

  const totalPlies = game?.moves.length ?? 0;
  const gameKey = `${game?.number ?? 0}-${game?.version ?? 0}`;
  const [viewState, setViewState] = useState<{ key: string; ply: number }>({
    key: gameKey,
    ply: totalPlies,
  });
  const viewPly = viewState.key === gameKey ? viewState.ply : totalPlies;

  const setViewPly = (updater: number | ((prev: number) => number)) => {
    setViewState((prev) => {
      const base = prev.key === gameKey ? prev.ply : totalPlies;
      const next = typeof updater === "function" ? updater(base) : updater;
      return { key: gameKey, ply: next };
    });
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setViewState((prev) => {
          const base = prev.key === gameKey ? prev.ply : totalPlies;
          return { key: gameKey, ply: Math.max(0, base - 1) };
        });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setViewState((prev) => {
          const base = prev.key === gameKey ? prev.ply : totalPlies;
          return { key: gameKey, ply: Math.min(totalPlies, base + 1) };
        });
      } else if (e.key === "Home") {
        e.preventDefault();
        setViewState({ key: gameKey, ply: 0 });
      } else if (e.key === "End") {
        e.preventDefault();
        setViewState({ key: gameKey, ply: totalPlies });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameKey, totalPlies]);

  const boardState = useMemo(() => {
    if (!game) return null;
    const chess = new Chess(game.startFen);
    const clampedPly = Math.min(Math.max(0, viewPly), game.moves.length);
    for (let i = 0; i < clampedPly; i++) {
      const m = game.moves[i]!;
      chess.move({
        from: m.from,
        to: m.to,
        ...(m.promotion ? { promotion: m.promotion } : {}),
      });
    }
    const lastMove = clampedPly > 0 ? game.moves[clampedPly - 1]! : null;
    return { board: chess.board(), lastMove, clampedPly };
  }, [game, viewPly]);

  if (!game || !boardState) {
    return (
      <div className="admin-stack">
        <div className="admin-page-head">
          <h1>Chess</h1>
        </div>
        <div className="admin-card">
          <p className="admin-auth-sub">No chess games recorded yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-stack">
      <div className="admin-page-head">
        <div>
          <h1>
            Chess · Game {game.number}
            {game.number === activeGameNumber ? (
              <span className="admin-badge ok" style={{ marginLeft: "10px", verticalAlign: "middle" }}>
                Active
              </span>
            ) : (
              <span className="admin-badge" style={{ marginLeft: "10px", verticalAlign: "middle" }}>
                {game.status}
                {game.result ? ` (${game.result})` : ""}
              </span>
            )}
          </h1>
          <p className="admin-auth-sub">
            v{game.version} · {game.moves.length} moves · {game.visitorCount} visitors · Started{" "}
            {formatDate(game.startedAt)}
          </p>
        </div>
        {canMutate && game.status === "active" ? (
          <div className="admin-row-actions">
            <button
              type="button"
              className="admin-btn sm"
              disabled={pending || game.moves.length === 0}
              onClick={() => {
                startTransition(async () => {
                  const res = await undoLastChessMoveAction(game.number);
                  setNotice(res.message ?? null);
                  router.refresh();
                });
              }}
            >
              Undo last move
            </button>
            <button
              type="button"
              className="admin-btn sm danger"
              disabled={pending}
              onClick={() => endDialogRef.current?.showModal()}
            >
              End game
            </button>
          </div>
        ) : canMutate ? null : (
          <span className="admin-badge">Read-only</span>
        )}
      </div>

      {notice ? (
        <div className="admin-alert ok" role="status">
          {notice}
        </div>
      ) : null}

      <div className="admin-chess-grid">
        <div className="admin-card">
          <div className="admin-board" role="img" aria-label={`Chess board at ply ${boardState.clampedPly}`}>
            {RANKS.map((rank, rIdx) =>
              FILES.map((file, fIdx) => {
                const sq = `${file}${rank}`;
                const isLight = (rIdx + fIdx) % 2 === 0;
                const piece = boardState.board[rIdx]?.[fIdx] ?? null;
                const isHl =
                  boardState.lastMove?.from === sq || boardState.lastMove?.to === sq;
                return (
                  <div
                    key={sq}
                    className={`admin-sq ${isLight ? "light" : "dark"}${isHl ? " hl" : ""}`}
                  >
                    {piece ? (
                      <Image
                        src={pieceSrc(piece.type, piece.color)}
                        alt={`${piece.color === "w" ? "White" : "Black"} ${piece.type}`}
                        width={40}
                        height={40}
                      />
                    ) : null}
                  </div>
                );
              }),
            )}
          </div>

          <div className="admin-row-actions" style={{ justifyContent: "space-between" }}>
            <div className="admin-row-actions">
              <button
                type="button"
                className="admin-btn sm"
                onClick={() => setViewPly(0)}
                disabled={boardState.clampedPly === 0}
                aria-label="First position"
              >
                «
              </button>
              <button
                type="button"
                className="admin-btn sm"
                onClick={() => setViewPly((p) => Math.max(0, p - 1))}
                disabled={boardState.clampedPly === 0}
                aria-label="Previous move"
              >
                ‹
              </button>
              <button
                type="button"
                className="admin-btn sm"
                onClick={() => setViewPly((p) => Math.min(totalPlies, p + 1))}
                disabled={boardState.clampedPly === totalPlies}
                aria-label="Next move"
              >
                ›
              </button>
              <button
                type="button"
                className="admin-btn sm"
                onClick={() => setViewPly(totalPlies)}
                disabled={boardState.clampedPly === totalPlies}
                aria-label="Latest position"
              >
                »
              </button>
            </div>
            <span className="mono" style={{ color: "var(--muted)" }}>
              Ply {boardState.clampedPly}/{totalPlies}
            </span>
          </div>
        </div>

        <div className="admin-card">
          <h2>Move log</h2>
          {game.moves.length === 0 ? (
            <p className="admin-auth-sub">No moves played yet.</p>
          ) : (
            <div className="admin-table-wrap admin-move-log">
              <table className="admin-table stack-mobile compact">
                <thead>
                  <tr>
                    <th>Ply</th>
                    <th>SAN</th>
                    <th>From → To</th>
                    <th>Location</th>
                    <th>Visitor</th>
                    <th>Time</th>
                    {canMutate ? <th>Cooldown</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {game.moves.map((m) => {
                    const isCurrent = boardState.clampedPly === m.ply;
                    const loc = [m.city, m.country].filter(Boolean).join(", ") || "—";
                    return (
                      <tr
                        key={m.ply}
                        style={isCurrent ? { background: "var(--surface)" } : undefined}
                      >
                        <td data-label="Ply" className="mono">
                          <div>
                            <button
                              type="button"
                              className="admin-btn sm"
                              style={{ minWidth: "44px", padding: "0 10px" }}
                              aria-label={`Show position at ply ${m.ply}`}
                              onClick={() => setViewPly(m.ply)}
                            >
                              {m.ply}
                            </button>
                          </div>
                        </td>
                        <td data-label="SAN" className="mono" style={{ fontWeight: 600 }}>
                          {m.san}
                        </td>
                        <td data-label="From → To" className="mono">
                          <span className="admin-nowrap">
                            {m.from} → {m.to}
                          </span>
                        </td>
                        <td data-label="Location">{loc}</td>
                        <td data-label="Visitor" className="mono">{m.visitorPrefix}</td>
                        <td data-label="Time" className="mono" style={{ color: "var(--muted)" }}>
                          <DateTimeParts iso={m.playedAt} />
                        </td>
                        {canMutate ? (
                          <td data-label="Cooldown">
                            <div className="admin-row-actions">
                              <button
                                type="button"
                                className="admin-btn sm"
                                disabled={pending}
                                aria-label={`Clear cooldown for visitor ${m.visitorPrefix}`}
                                onClick={() => {
                                  startTransition(async () => {
                                    const res = await clearChessCooldownAction(m.visitorPrefix);
                                    setNotice(`Cleared ${res.deletedCount} lock(s) for ${m.visitorPrefix}.`);
                                  });
                                }}
                              >
                                Clear
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="admin-card">
        <h2>Games</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Status</th>
                <th>Result</th>
                <th>Moves</th>
                <th>Visitors</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.number} style={g.number === game.number ? { background: "var(--surface)" } : undefined}>
                  <td>
                    <Link href={`/admin/chess?game=${g.number}`} style={{ fontWeight: 600 }}>
                      Game {g.number}
                    </Link>
                  </td>
                  <td>
                    <span className={`admin-badge ${g.status === "active" ? "ok" : ""}`}>{g.status}</span>
                  </td>
                  <td className="mono">{g.result ?? "—"}</td>
                  <td className="mono">{g.moveCount}</td>
                  <td className="mono">{g.visitorCount}</td>
                  <td className="mono" style={{ color: "var(--muted)" }}>
                    {formatDate(g.startedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <dialog ref={endDialogRef} className="admin-dialog" aria-labelledby="end-game-title">
        <div className="admin-stack">
          <h2 id="end-game-title" style={{ margin: 0 }}>
            End Game {game.number}?
          </h2>
          <p className="admin-auth-sub">
            This marks Game {game.number} as a draw and immediately starts a new game.
          </p>
          <div className="admin-row-actions" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="admin-btn sm" onClick={() => endDialogRef.current?.close()}>
              Cancel
            </button>
            <button
              type="button"
              className="admin-btn sm danger"
              disabled={pending}
              onClick={() => {
                endDialogRef.current?.close();
                startTransition(async () => {
                  const res = await endChessGameAction(game.number);
                  if (res.ok && res.nextGameNumber) {
                    setNotice(`Game ${game.number} ended. Started Game ${res.nextGameNumber}.`);
                    router.push(`/admin/chess?game=${res.nextGameNumber}`);
                    router.refresh();
                  }
                });
              }}
            >
              End &amp; start new game
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
