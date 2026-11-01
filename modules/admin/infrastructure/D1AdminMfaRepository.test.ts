import { afterEach, describe, expect, it } from "vitest";
import { D1SqliteTestDatabase } from "../../shared-kernel/testing/D1SqliteTestDatabase";
import { D1AdminMfaRepository } from "./D1AdminMfaRepository";

let database: D1SqliteTestDatabase;
afterEach(() => database.close());

function setup() {
  database = new D1SqliteTestDatabase();
  database.exec(`
    CREATE TABLE admin_users (id TEXT PRIMARY KEY);
    INSERT INTO admin_users(id) VALUES ('admin-1');
    CREATE TABLE admin_mfa_credentials (
      admin_user_id TEXT PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
      encrypted_secret TEXT NOT NULL, secret_iv TEXT NOT NULL, key_version INTEGER NOT NULL,
      enabled_at TEXT, last_used_step INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE admin_mfa_recovery_codes (
      id TEXT PRIMARY KEY, admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(admin_user_id,code_hash)
    );
    CREATE TABLE admin_mfa_challenges (
      challenge_hash TEXT PRIMARY KEY, admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL,
      consumed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE admin_step_up_grants (
      id TEXT PRIMARY KEY, admin_user_id TEXT NOT NULL, consumed_at TEXT
    );
    CREATE TABLE admin_sessions (
      id TEXT PRIMARY KEY, admin_user_id TEXT NOT NULL, revoked_at TEXT
    );
    INSERT INTO admin_sessions(id,admin_user_id) VALUES ('session-1','admin-1');
    INSERT INTO admin_step_up_grants(id,admin_user_id) VALUES ('grant-1','admin-1');
  `);
  return new D1AdminMfaRepository(database.asD1());
}

describe("D1AdminMfaRepository", () => {
  it("stores a pending encrypted secret and atomically enables it once", async () => {
    const repository = setup();
    expect(await repository.savePendingCredential({
      adminUserId: "admin-1", encryptedSecret: "ciphertext", secretIv: "iv", keyVersion: 1,
    })).toBe(true);
    expect(await repository.savePendingCredential({
      adminUserId: "admin-1", encryptedSecret: "replacement", secretIv: "iv2", keyVersion: 1,
    })).toBe(true);
    expect(await repository.getCredential("admin-1")).toMatchObject({
      encryptedSecret: "replacement", enabledAt: null, keyVersion: 1,
    });
    expect(await repository.enableAfterEnrollment("admin-1", 120, new Date().toISOString())).toBe(true);
    expect(await repository.enableAfterEnrollment("admin-1", 121, new Date().toISOString())).toBe(false);
    expect(await repository.advanceTotpStep("admin-1", 120)).toBe(false);
    expect(await repository.advanceTotpStep("admin-1", 121)).toBe(true);
  });

  it("limits challenge attempts and consumes a valid challenge once", async () => {
    const repository = setup();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    await repository.createChallenge({
      challengeHash: "challenge-1", adminUserId: "admin-1", purpose: "login", expiresAt,
    });
    expect(await repository.getChallenge("challenge-1")).toMatchObject({ adminUserId: "admin-1", attempts: 0 });
    for (let attempt = 0; attempt < 5; attempt += 1) await repository.incrementChallengeAttempts("challenge-1");
    expect(await repository.getChallenge("challenge-1")).toBeNull();
    expect(await repository.consumeChallenge("challenge-1")).toBe(false);

    await repository.createChallenge({
      challengeHash: "challenge-2", adminUserId: "admin-1", purpose: "login", expiresAt,
    });
    expect(await repository.consumeChallenge("challenge-2")).toBe(true);
    expect(await repository.consumeChallenge("challenge-2")).toBe(false);
  });

  it("stores only recovery-code hashes and consumes each code once", async () => {
    const repository = setup();
    await repository.replaceRecoveryCodes("admin-1", ["hash-a", "hash-b"]);
    expect(await repository.recoveryCodeCount("admin-1")).toBe(2);
    expect(await repository.consumeRecoveryCode("admin-1", "hash-a")).toBe(true);
    expect(await repository.consumeRecoveryCode("admin-1", "hash-a")).toBe(false);
    expect(await repository.recoveryCodeCount("admin-1")).toBe(1);
  });

  it("disables MFA by deleting factors and revoking sessions and step-up grants", async () => {
    const repository = setup();
    await repository.savePendingCredential({
      adminUserId: "admin-1", encryptedSecret: "ciphertext", secretIv: "iv", keyVersion: 1,
    });
    await repository.replaceRecoveryCodes("admin-1", ["hash-a"]);
    await repository.createChallenge({
      challengeHash: "challenge-3", adminUserId: "admin-1", purpose: "enroll",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await repository.disable("admin-1");
    expect(await repository.getCredential("admin-1")).toBeNull();
    expect(await repository.recoveryCodeCount("admin-1")).toBe(0);
    expect(database.query<{ revoked_at: string | null }>("SELECT revoked_at FROM admin_sessions WHERE id='session-1'")[0]?.revoked_at).not.toBeNull();
    expect(database.query<{ consumed_at: string | null }>("SELECT consumed_at FROM admin_step_up_grants WHERE id='grant-1'")).toHaveLength(0);
  });
});
