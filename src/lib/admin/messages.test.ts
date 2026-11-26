import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { openMessageForAdmin, queryMessages } = await import("./data");
const { mutateMessageArchive, mutateMessageDelete, mutateMessageRead } = await import("./mutations");

describe("admin messages", () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    db = client.db("admin_messages_test");
  });

  afterAll(async () => {
    await client?.close();
    await mongod?.stop();
  });

  beforeEach(async () => {
    await db.collection("messages").deleteMany({});
    await db.collection("admin_audit").deleteMany({});
  });

  const ownerAdmin = {
    _id: new ObjectId(),
    email: "owner@example.com",
    name: "Owner",
    role: "owner" as const,
    passwordHash: "x",
    backupCodeHashes: [],
    createdAt: new Date(),
    passwordChangedAt: null,
    lastSignInAt: null,
    disabledAt: null,
  };

  const viewerAdmin = {
    ...ownerAdmin,
    _id: new ObjectId(),
    email: "viewer@example.com",
    name: "Viewer",
    role: "viewer" as const,
  };

  it("filters by all, unread, noemail, archived, and search query", async () => {
    const base = Date.now();
    await db.collection("messages").insertMany([
      { name: "Alice", email: "alice@ex.com", message: "Hello world", createdAt: new Date(base - 1000), emailed: true, readAt: null, archivedAt: null },
      { name: "Bob", email: "bob@ex.com", message: "Project inquiry", createdAt: new Date(base - 2000), emailed: false, readAt: new Date(), archivedAt: null },
      { name: "Carol", email: "carol@ex.com", message: "Archived note", createdAt: new Date(base - 3000), emailed: true, readAt: new Date(), archivedAt: new Date() },
    ]);

    const all = await queryMessages(db, { filter: "all" });
    expect(all.total).toBe(2);

    const unread = await queryMessages(db, { filter: "unread" });
    expect(unread.items.map((m) => m.name)).toEqual(["Alice"]);

    const noemail = await queryMessages(db, { filter: "noemail" });
    expect(noemail.items.map((m) => m.name)).toEqual(["Bob"]);

    const archived = await queryMessages(db, { filter: "archived" });
    expect(archived.items.map((m) => m.name)).toEqual(["Carol"]);

    const search = await queryMessages(db, { filter: "all", q: "inquiry" });
    expect(search.items.map((m) => m.name)).toEqual(["Bob"]);
  });

  it("paginates 25 items per page", async () => {
    const docs = Array.from({ length: 30 }, (_, i) => ({
      name: `Sender ${i + 1}`,
      email: `s${i + 1}@example.com`,
      message: `Message body ${i + 1}`,
      createdAt: new Date(Date.now() - i * 1000),
      emailed: true,
      readAt: null,
      archivedAt: null,
    }));
    await db.collection("messages").insertMany(docs);

    const p1 = await queryMessages(db, { page: 1 });
    expect(p1.total).toBe(30);
    expect(p1.totalPages).toBe(2);
    expect(p1.items).toHaveLength(25);
    expect(p1.items[0]?.name).toBe("Sender 1");

    const p2 = await queryMessages(db, { page: 2 });
    expect(p2.items).toHaveLength(5);
    expect(p2.items[0]?.name).toBe("Sender 26");
  });

  it("marks readAt when opened by non-viewer and blocks Viewer mutations", async () => {
    const id = new ObjectId();
    await db.collection("messages").insertOne({
      _id: id,
      name: "Dana",
      email: "dana@example.com",
      message: "Test message",
      createdAt: new Date(),
      emailed: true,
      readAt: null,
      archivedAt: null,
    });

    // Viewer opening does not mutate readAt
    const viewerOpen = await openMessageForAdmin(db, id.toString(), false);
    expect(viewerOpen.markedRead).toBe(false);
    expect(viewerOpen.message?.readAt).toBeNull();

    // Viewer cannot call mutations
    await expect(mutateMessageRead(db, viewerAdmin, id.toString(), true)).rejects.toThrow("Forbidden");
    await expect(mutateMessageArchive(db, viewerAdmin, id.toString(), true)).rejects.toThrow("Forbidden");
    await expect(mutateMessageDelete(db, viewerAdmin, id.toString())).rejects.toThrow("Forbidden");

    // Owner opening marks readAt
    const ownerOpen = await openMessageForAdmin(db, id.toString(), true);
    expect(ownerOpen.markedRead).toBe(true);
    expect(ownerOpen.message?.readAt).not.toBeNull();

    // Owner can archive and delete
    await expect(mutateMessageArchive(db, ownerAdmin, id.toString(), true)).resolves.toBe(true);
    await expect(mutateMessageDelete(db, ownerAdmin, id.toString())).resolves.toBe(true);
    expect(await db.collection("messages").countDocuments({ _id: id })).toBe(0);
  });
});
