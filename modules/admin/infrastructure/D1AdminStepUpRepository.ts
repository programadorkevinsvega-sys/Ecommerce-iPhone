import type { D1Database } from "@cloudflare/workers-types";
import type { AdminStepUpRepository, AdminStepUpScope } from "../application/AdminStepUpRepository";

export class D1AdminStepUpRepository implements AdminStepUpRepository {
  constructor(private readonly db: D1Database) {}

  async create(
    input: Readonly<{
      adminUserId: string;
      sessionTokenHash: string;
      tokenHash: string;
      scope: AdminStepUpScope;
      expiresAt: string;
    }>,
  ): Promise<void> {
    await this.db.batch([
      this.db.prepare(
        "DELETE FROM admin_step_up_grants WHERE datetime(expires_at)<=CURRENT_TIMESTAMP",
      ),
      this.db
        .prepare(
          "INSERT INTO admin_step_up_grants (id,admin_user_id,session_token_hash,token_hash,scope,expires_at) VALUES (?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          input.adminUserId,
          input.sessionTokenHash,
          input.tokenHash,
          input.scope,
          input.expiresAt,
        ),
    ]);
  }

  async consumeValid(
    input: Readonly<{
      adminUserId: string;
      sessionTokenHash: string;
      tokenHash: string;
      scope: AdminStepUpScope;
    }>,
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        "UPDATE admin_step_up_grants SET consumed_at=CURRENT_TIMESTAMP WHERE admin_user_id=? AND session_token_hash=? AND token_hash=? AND scope=? AND consumed_at IS NULL AND datetime(expires_at)>CURRENT_TIMESTAMP",
      )
      .bind(input.adminUserId, input.sessionTokenHash, input.tokenHash, input.scope)
      .run();
    return result.meta.changes === 1;
  }
}
