import type { D1Database } from "@cloudflare/workers-types";
import type { AdminPermissionRepository, PermissionOverride } from "../application/AdminPermissionRepository";
import type { Permission } from "../application/Rbac";

export class D1AdminPermissionRepository implements AdminPermissionRepository {
  constructor(private readonly db: D1Database) {}

  async getOverrides(adminUserId: string): Promise<ReadonlyArray<PermissionOverride>> {
    const result = await this.db
      .prepare("SELECT permission, granted FROM admin_user_permissions WHERE admin_user_id = ? ORDER BY permission")
      .bind(adminUserId)
      .all<{ permission: string; granted: number }>();
    return result.results.map((row) => ({
      permission: row.permission as Permission,
      granted: Number(row.granted) === 1,
    }));
  }

  async replaceOverrides(adminUserId: string, overrides: ReadonlyArray<PermissionOverride>): Promise<void> {
    const statements = [
      this.db.prepare("DELETE FROM admin_user_permissions WHERE admin_user_id = ?").bind(adminUserId),
      ...overrides.map((override) =>
        this.db
          .prepare(
            "INSERT INTO admin_user_permissions (admin_user_id, permission, granted) VALUES (?, ?, ?)",
          )
          .bind(adminUserId, override.permission, override.granted ? 1 : 0),
      ),
    ];
    await this.db.batch(statements);
  }
}
