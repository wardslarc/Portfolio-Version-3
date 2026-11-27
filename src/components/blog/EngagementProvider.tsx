"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  LikeResponsePayload,
  PublicEngagementPayload,
  ShareChannel,
} from "@/lib/blog/engagement-types";

export type EngagementStatus = "loading" | "ready" | "unavailable";

export interface EngagementContextValue {
  data: PublicEngagementPayload | null;
  status: EngagementStatus;
  likePending: boolean;
  likeError: string | null;
  setLiked: (nextLiked: boolean) => Promise<void>;
  recordShare: (channel: ShareChannel) => void;
}

const EngagementContext = createContext<EngagementContextValue | null>(null);

export function useEngagement(): EngagementContextValue | null {
  return useContext(EngagementContext);
}

export default function EngagementProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [data, setData] = useState<PublicEngagementPayload | null>(null);
  const [status, setStatus] = useState<EngagementStatus>("loading");
  const [likePending, setLikePending] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sharedChannelsRef = useRef<Set<ShareChannel>>(new Set());

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    sharedChannelsRef.current = new Set();

    fetch(`/api/blog/engagement?slug=${encodeURIComponent(slug)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          setStatus("unavailable");
          return;
        }
        const payload = (await res.json()) as PublicEngagementPayload;
        if (!active) return;
        setData(payload);
        setStatus("ready");
      })
      .catch((err) => {
        if (!active || (err instanceof Error && err.name === "AbortError")) return;
        setStatus("unavailable");
      });

    return () => {
      active = false;
      controller.abort();
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [slug]);

  const showError = useCallback((message: string) => {
    setLikeError(message);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setLikeError(null), 3200);
  }, []);

  const setLiked = useCallback(
    async (nextLiked: boolean) => {
      if (inFlightRef.current || status !== "ready" || !data) return;

      inFlightRef.current = true;
      setLikePending(true);
      setLikeError(null);

      const snapshot = data;
      const optimisticLikes =
        snapshot.hidden || snapshot.likes === null
          ? null
          : Math.max(0, snapshot.likes + (nextLiked ? 1 : -1));

      setData({
        ...snapshot,
        liked: nextLiked,
        likes: optimisticLikes,
      });

      try {
        const res = await fetch("/api/blog/like", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, liked: nextLiked }),
        });

        if (!res.ok) {
          setData(snapshot);
          showError("Couldn't save your like");
          return;
        }

        const result = (await res.json()) as LikeResponsePayload;
        if (result.limited) {
          setData(snapshot);
          showError("Too many likes from your network.");
          return;
        }

        setData((current) => {
          const base = current ?? snapshot;
          return {
            ...base,
            liked: result.liked,
            likes: base.hidden ? null : result.likes,
          };
        });
      } catch {
        setData(snapshot);
        showError("Couldn't save your like");
      } finally {
        inFlightRef.current = false;
        setLikePending(false);
      }
    },
    [data, showError, slug, status],
  );

  const recordShare = useCallback(
    (channel: ShareChannel) => {
      const payload = JSON.stringify({ slug, channel });
      const url = "/api/blog/share";

      let sentViaBeacon = false;
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([payload], { type: "application/json" });
        sentViaBeacon = navigator.sendBeacon(url, blob);
      }

      if (!sentViaBeacon) {
        fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }

      if (!sharedChannelsRef.current.has(channel)) {
        sharedChannelsRef.current.add(channel);
        setData((current) => {
          if (!current || current.hidden || current.shares === null) return current;
          return { ...current, shares: current.shares + 1 };
        });
      }
    },
    [slug],
  );

  const value = useMemo<EngagementContextValue>(
    () => ({
      data,
      status,
      likePending,
      likeError,
      setLiked,
      recordShare,
    }),
    [data, likeError, likePending, recordShare, setLiked, status],
  );

  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>;
}
