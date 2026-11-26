export type AdminRole = "owner" | "admin" | "viewer";

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Owner",
  admin: "Admin",
  viewer: "Viewer",
};

export type AdminAction =
  | "overview:view"
  | "messages:view"
  | "messages:mutate"
  | "chess:view"
  | "chess:mutate"
  | "admins:manage"
  | "audit:view"
  | "security:self";

const ROLE_RANK: Record<AdminRole, number> = {
  viewer: 1,
  admin: 2,
  owner: 3,
};

const PERMISSIONS: Record<AdminRole, ReadonlySet<AdminAction>> = {
  owner: new Set<AdminAction>([
    "overview:view",
    "messages:view",
    "messages:mutate",
    "chess:view",
    "chess:mutate",
    "admins:manage",
    "audit:view",
    "security:self",
  ]),
  admin: new Set<AdminAction>([
    "overview:view",
    "messages:view",
    "messages:mutate",
    "chess:view",
    "chess:mutate",
    "audit:view",
    "security:self",
  ]),
  viewer: new Set<AdminAction>([
    "overview:view",
    "messages:view",
    "chess:view",
    "security:self",
  ]),
};

export function can(role: AdminRole, action: AdminAction): boolean {
  return PERMISSIONS[role]?.has(action) ?? false;
}

export function hasMinRole(role: AdminRole, minRole: AdminRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}
