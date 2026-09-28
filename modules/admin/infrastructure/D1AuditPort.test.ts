import { describe, expect, it } from "vitest";
import { D1SqliteTestDatabase } from "../../shared-kernel/testing/D1SqliteTestDatabase";
import { D1AuditPort } from "./D1AuditPort";

describe("D1AuditPort", () => {
  it("persists unauthenticated audit events with a NULL admin foreign key", async () => {
    const db = new D1SqliteTestDatabase();
    db.exec("CREATE TABLE admin_users (id TEXT PRIMARY KEY)");
    db.exec("CREATE TABLE admin_audit_log (id TEXT PRIMARY KEY, admin_user_id TEXT REFERENCES admin_users(id), action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT, payload_json TEXT NOT NULL, ip_hash TEXT)");
    await new D1AuditPort(db.asD1()).audit(null, "ADMIN_LOGIN_FAILED", "admin_user", null, { reason: "invalid_credentials" });
    expect(db.query<{ admin_user_id: string | null }>("SELECT admin_user_id FROM admin_audit_log")[0]?.admin_user_id).toBeNull();
    db.close();
  });
});
