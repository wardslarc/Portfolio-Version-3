import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { queryAdminChessData } from "@/lib/admin/data";
import { can } from "@/lib/admin/permissions";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import ChessAdminClient from "./ChessAdminClient";

export const metadata: Metadata = {
  title: "Chess",
};

async function ChessContent({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const { admin } = await requireAdmin("viewer");
  const sp = await searchParams;
  const requestedGame = sp.game ? Number.parseInt(sp.game, 10) : undefined;
  const validGameNum = requestedGame && Number.isFinite(requestedGame) && requestedGame > 0 ? requestedGame : undefined;

  if (!isMongoConfigured()) {
    return (
      <div className="admin-card">
        <p className="admin-auth-sub">Database is not configured.</p>
      </div>
    );
  }

  const db = await getDb();
  const data = await queryAdminChessData(db, validGameNum);

  return (
    <ChessAdminClient
      game={data.game}
      activeGameNumber={data.activeGameNumber}
      games={data.games}
      canMutate={can(admin.role, "chess:mutate")}
    />
  );
}

export default function AdminChessPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  return (
    <Suspense fallback={<div className="admin-card">Loading chess…</div>}>
      <ChessContent searchParams={searchParams} />
    </Suspense>
  );
}
