import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminDoc } from "@/lib/admin/auth";
import { MEDIA_COLLECTION, ensureBlogIndexes } from "./indexes";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

let currentDb: Db;
let currentActor: AdminDoc;

vi.mock("@/lib/mongodb", () => ({
  isMongoConfigured: () => true,
  getDb: async () => currentDb,
}));

vi.mock("@/lib/admin/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/auth")>("@/lib/admin/auth");
  return {
    ...actual,
    requireAdminAction: async (action: string) => {
      if (currentActor.role === "viewer" && action === "blog:write") {
        throw new Error("Forbidden");
      }
      return { admin: currentActor, session: {} };
    },
  };
});

const headMock = vi.fn();
const delMock = vi.fn();

vi.mock("@vercel/blob", () => ({
  head: headMock,
  del: delMock,
}));

const { deleteMediaItem, isValidBlobUrl, registerMedia } = await import("./media");
const { registerMediaAction } = await import("@/lib/admin/actions");

function makeAdmin(role: "owner" | "admin" | "viewer" = "owner"): AdminDoc {
  return {
    _id: new ObjectId(),
    email: `${role}@example.com`,
    name: `Test ${role}`,
    role,
    passwordHash: "hash",
    backupCodeHashes: [],
    createdAt: new Date("2026-11-01T00:00:00Z"),
    passwordChangedAt: null,
    lastSignInAt: null,
    disabledAt: null,
  };
}

describe("blog media helpers & registerMediaAction", () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    db = client.db("blog_media_test");
    currentDb = db;
    await ensureBlogIndexes(db);
  });

  afterAll(async () => {
    await client?.close();
    await mongod?.stop();
  });

  beforeEach(async () => {
    currentActor = makeAdmin("owner");
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test_123";
    headMock.mockReset();
    delMock.mockReset();
    await Promise.all([
      db.collection(MEDIA_COLLECTION).deleteMany({}),
      db.collection("admin_audit").deleteMany({}),
    ]);
  });

  it("validates Blob URLs strictly against *.public.blob.vercel-storage.com/blog/*", () => {
    expect(isValidBlobUrl("https://k3x9.public.blob.vercel-storage.com/blog/img-abc.webp")).toBe(true);
    expect(isValidBlobUrl("http://k3x9.public.blob.vercel-storage.com/blog/img-abc.webp")).toBe(false);
    expect(isValidBlobUrl("https://evil.com/blog/img-abc.webp")).toBe(false);
    expect(isValidBlobUrl("https://public.blob.vercel-storage.com.evil.com/blog/img.webp")).toBe(false);
    expect(isValidBlobUrl("https://k3x9.public.blob.vercel-storage.com/other/img.webp")).toBe(false);
  });

  it("rejects foreign hosts in registerMediaAction without calling head()", async () => {
    const res = await registerMediaAction({
      url: "https://evil.example.com/blog/pic.webp",
      width: 1200,
      height: 800,
    });
    expect(res).toEqual({ ok: false, error: "Invalid Vercel Blob URL." });
    expect(headMock).not.toHaveBeenCalled();
  });

  it("registers verified Blob uploads and audits media.upload", async () => {
    const url = "https://k3x9.public.blob.vercel-storage.com/blog/board-123.webp";
    headMock.mockResolvedValueOnce({
      pathname: "blog/board-123.webp",
      contentType: "image/webp",
      size: 42_000,
    });

    const res = await registerMediaAction({ url, width: 1600, height: 900 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.media.filename).toBe("board-123.webp");
      expect(res.media.size).toBe(42_000);
      expect(res.media.usedByCount).toBe(0);
    }
    const audit = await db.collection("admin_audit").findOne({ action: "media.upload" });
    expect(audit?.target).toBe("blog/board-123.webp");
  });

  it("guards deleteMediaItem by usage and preserves doc if Blob del fails", async () => {
    const url1 = "https://k3x9.public.blob.vercel-storage.com/blog/used.webp";
    const url2 = "https://k3x9.public.blob.vercel-storage.com/blog/unused.webp";

    headMock.mockResolvedValue({
      pathname: "blog/test.webp",
      contentType: "image/webp",
      size: 1000,
    });

    const m1 = await registerMedia(db, currentActor, { url: url1, width: 800, height: 600 });
    const m2 = await registerMedia(db, currentActor, { url: url2, width: 800, height: 600 });
    expect(m1.ok && m2.ok).toBe(true);
    if (!m1.ok || !m2.ok) return;

    await db.collection(MEDIA_COLLECTION).updateOne(
      { _id: new ObjectId(m1.media.id) },
      { $set: { usedBy: [new ObjectId()] } },
    );

    const usedFail = await deleteMediaItem(db, currentActor, m1.media.id);
    expect(usedFail.ok).toBe(false);
    expect(delMock).not.toHaveBeenCalled();

    // Blob deletion failure preserves media doc
    delMock.mockRejectedValueOnce(new Error("Blob error"));
    const blobFail = await deleteMediaItem(db, currentActor, m2.media.id);
    expect(blobFail.ok).toBe(false);
    expect(await db.collection(MEDIA_COLLECTION).findOne({ _id: new ObjectId(m2.media.id) })).not.toBeNull();

    // Successful Blob deletion removes media doc and logs audit
    delMock.mockResolvedValueOnce(undefined);
    const okDel = await deleteMediaItem(db, currentActor, m2.media.id);
    expect(okDel).toEqual({ ok: true });
    expect(await db.collection(MEDIA_COLLECTION).findOne({ _id: new ObjectId(m2.media.id) })).toBeNull();
    expect(await db.collection("admin_audit").findOne({ action: "media.delete" })).not.toBeNull();
  });
});
