import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Overview",
};

export default function AdminOverviewPage() {
  return (
    <div className="admin-stack">
      <div className="admin-page-head">
        <h1>Overview</h1>
      </div>
      <div className="admin-card">
        <p className="admin-auth-sub">Admin shell ready.</p>
      </div>
    </div>
  );
}
