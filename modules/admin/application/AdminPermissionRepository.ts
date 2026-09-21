import type { Permission } from "./Rbac";

export type PermissionOverride = Readonly<{
  permission: Permission;
  granted: boolean;
}>;

export interface AdminPermissionRepository {
  getOverrides(adminUserId: string): Promise<ReadonlyArray<PermissionOverride>>;
  replaceOverrides(adminUserId: string, overrides: ReadonlyArray<PermissionOverride>): Promise<void>;
}
