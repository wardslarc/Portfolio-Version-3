import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { createDraftPost } from "@/lib/blog/posts";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

async function CreateAndRedirect() {
  const { admin } = await requireAdmin("admin");

  if (!isMongoConfigured()) {
    return (
      <div className="admin-card">
        <p className="admin-auth-sub">Database is not configured.</p>
      </div>
    );
  }

  const db = await getDb();
  const post = await createDraftPost(db, admin);
  redirect(`/admin/blog/${post._id.toString()}`);
}

export default function NewBlogPostPage() {
  return (
    <Suspense fallback={<div className="admin-card">Creating draft…</div>}>
      <CreateAndRedirect />
    </Suspense>
  );
}
