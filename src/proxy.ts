import { NextResponse, type NextRequest } from "next/server";
import { tagToSlug } from "@/lib/blog/slug";

export function proxy(request: NextRequest) {
  const rawTag = request.nextUrl.searchParams.get("tag")?.trim();
  if (!rawTag) {
    return NextResponse.next();
  }

  const tagSlug = tagToSlug(rawTag);
  const page = Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10);
  const target = request.nextUrl.clone();
  target.pathname = tagSlug ? `/blog/tag/${tagSlug}` : "/blog";
  target.search = Number.isFinite(page) && page > 1 ? `?page=${page}` : "";

  return NextResponse.redirect(target, 308);
}

export const config = {
  matcher: "/blog",
};
