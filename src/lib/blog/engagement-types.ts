import { z } from "zod";

export const SHARE_CHANNELS = ["copy", "x", "linkedin", "native"] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];
export const shareChannelSchema = z.enum(SHARE_CHANNELS);

export interface PostShares {
  copy: number;
  x: number;
  linkedin: number;
  native: number;
}

export function emptyShares(): PostShares {
  return { copy: 0, x: 0, linkedin: 0, native: 0 };
}

export function sumShares(shares?: Partial<PostShares> | null): number {
  if (!shares) return 0;
  return (shares.copy ?? 0) + (shares.x ?? 0) + (shares.linkedin ?? 0) + (shares.native ?? 0);
}

export interface PublicEngagementPayload {
  views: number | null;
  likes: number | null;
  shares: number | null;
  liked: boolean;
  hidden: boolean;
}

export interface LikeResponsePayload {
  liked: boolean;
  likes: number;
  tracked: boolean;
  limited?: boolean;
}
