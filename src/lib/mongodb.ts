import "server-only";
import { MongoClient, type Db } from "mongodb";

// Reuse one client per server instance. On Vercel, warm function invocations share the
// module scope, and in dev the global survives hot reloads, so we don't open a new pool
// on every request.
const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient> };

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  if (!globalForMongo._mongoClient) {
    globalForMongo._mongoClient = new MongoClient(uri, { maxPoolSize: 5 }).connect().catch((err) => {
      // Drop the failed promise so the next request retries instead of failing forever.
      globalForMongo._mongoClient = undefined;
      throw err;
    });
  }
  return globalForMongo._mongoClient;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || "portfolio");
}
