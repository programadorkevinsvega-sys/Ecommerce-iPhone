import { describe, expect, it } from "vitest";
import { D1SqliteTestDatabase } from "../../shared-kernel/testing/D1SqliteTestDatabase";
import { AdminUser } from "../domain/AdminUser";
import { D1AdminRepository } from "./D1AdminRepository";

function testDb() {
  const db = new D1SqliteTestDatabase();
  db.exec(`
    CREATE TABLE admin_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      active INTEGER NOT NULL,
      failed_login_count INTEGER NOT NULL,
      locked_until TEXT,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE admin_sessions (
      id TEXT PRIMARY KEY, admin_user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL, revoked_at TEXT, ip_hash TEXT, user_agent_hash TEXT
    );
    CREATE TABLE admin_mfa_credentials (
      admin_user_id TEXT PRIMARY KEY, enabled_at TEXT, encrypted_secret TEXT NOT NULL,
      secret_iv TEXT NOT NULL, key_version INTEGER NOT NULL, last_used_step INTEGER
    );
  `);
  return db;
}

function admin(id: string, email: string) {
  return AdminUser.create(id, {
    email,
    passwordHash: "pbkdf2-sha256$100000$hash",
    role: "SUPER_ADMIN",
    firstName: "Administrador",
    lastName: "Principal",
    active: true,
    failedLoginCount: 0,
  });
}

describe("D1AdminRepository bootstrap guard", () => {
  it("allows only one active SUPER_ADMIN through the atomic insert", async () => {
    const db = testDb();
    const repository = new D1AdminRepository(db.asD1());
    expect(await repository.createInitialSuperAdmin(admin("admin-1", "one@example.com"))).toBe(true);
    expect(await repository.createInitialSuperAdmin(admin("admin-2", "two@example.com"))).toBe(false);
    expect(db.query<{ email: string; password_hash: string }>("SELECT email, password_hash FROM admin_users")).toEqual([
      { email: "one@example.com", password_hash: "pbkdf2-sha256$100000$hash" },
    ]);
    db.close();
  });

  it("does not resolve a session until MFA is enabled for the administrator", async () => {
    const db = testDb();
    const repository = new D1AdminRepository(db.asD1());
    await repository.createInitialSuperAdmin(admin("admin-mfa-1", "mfa@example.com"));
    await repository.createSession("admin-mfa-1", "session-token-hash", new Date(Date.now() + 60_000).toISOString());
    expect(await repository.findSession("session-token-hash")).toBeNull();
    db.exec(
      "INSERT INTO admin_mfa_credentials(admin_user_id,encrypted_secret,secret_iv,key_version,enabled_at) VALUES(?,?,?,?,?)",
      "admin-mfa-1", "encrypted", "iv", 1, new Date().toISOString(),
    );
    expect(await repository.findSession("session-token-hash")).not.toBeNull();
    db.close();
  });

  it("does not create a second record for an existing email", async () => {
    const db = testDb();
    const repository = new D1AdminRepository(db.asD1());
    expect(await repository.createInitialSuperAdmin(admin("admin-1", "one@example.com"))).toBe(true);
    expect(await repository.createInitialSuperAdmin(admin("admin-2", "ONE@EXAMPLE.COM"))).toBe(false);
    expect(db.query<{ count: number }>("SELECT COUNT(*) AS count FROM admin_users")[0]?.count).toBe(1);
    db.close();
  });
});
