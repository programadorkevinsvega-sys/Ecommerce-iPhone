export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "SALES",
  "SUPPORT",
  "INVENTORY",
  "FINANCE",
  "CONTENT_EDITOR",
  "TECHNICIAN",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];
