import { afterEach, describe, expect, it } from "vitest";
import { D1SqliteTestDatabase } from "../../shared-kernel/testing/D1SqliteTestDatabase";
import { D1AdminStepUpRepository } from "./D1AdminStepUpRepository";

let database: D1SqliteTestDatabase;
afterEach(() => database.close());

describe("D1AdminStepUpRepository", () => {
  function createTable() {
    database = new D1SqliteTestDatabase();
    database.exec(`
      CREATE TABLE admin_step_up_grants (
        id TEXT PRIMARY KEY,
        admin_user_id TEXT NOT NULL,
        session_token_hash TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        scope TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        consumed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  it("binds a step-up proof to the current admin, session, token and scope", async () => {
    createTable();
    const repository = new D1AdminStepUpRepository(database.asD1());
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    await repository.create({
      adminUserId: "admin-1",
      sessionTokenHash: "session-hash-a",
      tokenHash: "proof-hash-a",
      scope: "payments:refund",
      expiresAt,
    });

    const base = {
      adminUserId: "admin-1",
      sessionTokenHash: "session-hash-a",
      tokenHash: "proof-hash-a",
      scope: "payments:refund" as const,
    };
    await expect(repository.consumeValid({ ...base, sessionTokenHash: "session-hash-b" })).resolves.toBe(false);
    await expect(repository.hasValid({ ...base, tokenHash: "proof-hash-b" })).resolves.toBe(false);
    await expect(repository.hasValid({ ...base, scope: "payments:void" })).resolves.toBe(false);
    await expect(repository.hasValid(base)).resolves.toBe(true);
    await expect(repository.hasValid(base)).resolves.toBe(false);

  });

  it("rejects an expired grant using SQLite date semantics", async () => {
    createTable();
    const repository = new D1AdminStepUpRepository(database.asD1());
    await repository.create({
      adminUserId: "admin-1",
      sessionTokenHash: "session-hash",
      tokenHash: "expired-proof",
      scope: "settings:write",
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });

    await expect(
      repository.hasValid({
        adminUserId: "admin-1",
        sessionTokenHash: "session-hash",
        tokenHash: "expired-proof",
        scope: "settings:write",
      }),
    ).resolves.toBe(false);
  });
});
