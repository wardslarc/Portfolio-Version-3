import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";
import { generateRandomToken, hmacHash } from "../src/lib/admin/crypto";

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

function loadEnvFile(filename: string): void {
  const fullPath = path.resolve(process.cwd(), filename);
  if (!existsSync(fullPath)) return;
  const content = readFileSync(fullPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const uri = process.env.MONGODB_URI;
  const ownerEmail = process.env.ADMIN_OWNER_EMAIL?.trim().toLowerCase();

  if (!uri) {
    console.error("Error: MONGODB_URI is not set.");
    process.exit(1);
  }
  if (!ownerEmail || !ownerEmail.includes("@")) {
    console.error("Error: ADMIN_OWNER_EMAIL must be set to a valid email address.");
    process.exit(1);
  }

  const client = await MongoClient.connect(uri, { maxPoolSize: 2 });
  try {
    const db = client.db(process.env.MONGODB_DB || "portfolio");
    const existingCount = await db.collection("admins").countDocuments({});
    if (existingCount > 0) {
      console.log("Admins already exist. Skipping bootstrap.");
      return;
    }

    const token = generateRandomToken(32);
    const tokenHash = hmacHash("invite", token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

    const invites = db.collection<{
      _id: string;
      email: string;
      role: "owner";
      invitedBy: null;
      createdAt: Date;
      expiresAt: Date;
      acceptedAt: Date | null;
    }>("admin_invites");

    await invites.deleteMany({ email: ownerEmail, acceptedAt: null });
    await invites.insertOne({
      _id: tokenHash,
      email: ownerEmail,
      role: "owner",
      invitedBy: null,
      createdAt: now,
      expiresAt,
      acceptedAt: null,
    });

    const baseUrl = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
    console.log(`Owner invite created for ${ownerEmail} (expires in 48 hours).`);
    console.log(`One-time invite link: ${baseUrl}/admin/invite/${token}`);
    console.log(`Relative path: /admin/invite/${token}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("admin:setup failed:", err);
  process.exit(1);
});
