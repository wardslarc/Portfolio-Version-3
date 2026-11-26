import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HandleUploadOptions } from "@vercel/blob/client";

vi.mock("server-only", () => ({}));

let authMode: "none" | "viewer" | "admin" = "admin";

vi.mock("@/lib/admin/auth", () => ({
  requireAdminAction: async (action: string) => {
    if (authMode === "none") throw new Error("Unauthorized");
    if (authMode === "viewer" && action === "blog:write") throw new Error("Forbidden");
    return { admin: { role: authMode }, session: {} };
  },
}));

const handleUploadMock = vi.fn(async (opts: HandleUploadOptions) => {
  if (opts.body.type === "blob.generate-client-token") {
    const tokenOpts = await opts.onBeforeGenerateToken(
      opts.body.payload.pathname,
      opts.body.payload.clientPayload,
      opts.body.payload.multipart,
    );
    expect(tokenOpts.allowedContentTypes).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
    ]);
    expect(tokenOpts.maximumSizeInBytes).toBe(8 * 1024 * 1024);
    expect(tokenOpts.addRandomSuffix).toBe(true);
    return {
      type: "blob.generate-client-token" as const,
      clientToken: "vercel_blob_client_test_token",
    };
  }
  return { type: "blob.upload-completed" as const, response: "ok" as const };
});

vi.mock("@vercel/blob/client", () => ({
  handleUpload: handleUploadMock,
}));

const { POST } = await import("./route");

function makeUploadReq(pathname: string, clientPayload: string | null = null): Request {
  return new Request("http://localhost/admin/api/blob", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "blob.generate-client-token",
      payload: { pathname, clientPayload, multipart: false },
    }),
  });
}

describe("POST /admin/api/blob", () => {
  beforeEach(() => {
    authMode = "admin";
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test_123";
    handleUploadMock.mockClear();
  });

  it("rejects requests without an admin session (401)", async () => {
    authMode = "none";
    const res = await POST(makeUploadReq("blog/photo.webp"));
    expect(res.status).toBe(401);
    expect(handleUploadMock).not.toHaveBeenCalled();
  });

  it("rejects viewer role (403)", async () => {
    authMode = "viewer";
    const res = await POST(makeUploadReq("blog/photo.webp"));
    expect(res.status).toBe(403);
    expect(handleUploadMock).not.toHaveBeenCalled();
  });

  it("rejects paths outside blog/ or with unsupported extensions (400)", async () => {
    const r1 = await POST(makeUploadReq("other/photo.webp"));
    expect(r1.status).toBe(400);

    const r2 = await POST(makeUploadReq("blog/../secret.webp"));
    expect(r2.status).toBe(400);

    const r3 = await POST(makeUploadReq("blog/vector.svg"));
    expect(r3.status).toBe(400);
  });

  it("rejects disallowed contentType in clientPayload (400)", async () => {
    const res = await POST(
      makeUploadReq("blog/photo.webp", JSON.stringify({ contentType: "image/svg+xml" })),
    );
    expect(res.status).toBe(400);
  });

  it("issues a client token for valid admin uploads", async () => {
    const res = await POST(
      makeUploadReq("blog/photo.webp", JSON.stringify({ contentType: "image/webp" })),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: "blob.generate-client-token",
      clientToken: "vercel_blob_client_test_token",
    });
    expect(handleUploadMock).toHaveBeenCalledTimes(1);
  });
});
