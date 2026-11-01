import type { D1Database } from "@cloudflare/workers-types";

export type AdminMfaPurpose = "login" | "enroll";
export type AdminMfaCredential = Readonly<{
  encryptedSecret: string;
  secretIv: string;
  keyVersion: number;
  enabledAt: string | null;
  lastUsedStep: number | null;
}>;
export type AdminMfaChallenge = Readonly<{
  adminUserId: string;
  purpose: AdminMfaPurpose;
  attempts: number;
}>;

export class D1AdminMfaRepository {
  constructor(private readonly db: D1Database) {}

  async getCredential(adminUserId: string): Promise<AdminMfaCredential | null> {
    const row = await this.db.prepare(
      "SELECT encrypted_secret,secret_iv,key_version,enabled_at,last_used_step FROM admin_mfa_credentials WHERE admin_user_id=? LIMIT 1",
    ).bind(adminUserId).first<{
      encrypted_secret: string; secret_iv: string; key_version: number;
      enabled_at: string | null; last_used_step: number | null;
    }>();
    return row ? {
      encryptedSecret: row.encrypted_secret,
      secretIv: row.secret_iv,
      keyVersion: Number(row.key_version),
      enabledAt: row.enabled_at,
      lastUsedStep: row.last_used_step === null ? null : Number(row.last_used_step),
    } : null;
  }

  async savePendingCredential(input: Readonly<{
    adminUserId: string; encryptedSecret: string; secretIv: string; keyVersion: number;
  }>): Promise<boolean> {
    const result = await this.db.prepare(
      `INSERT INTO admin_mfa_credentials(admin_user_id,encrypted_secret,secret_iv,key_version,enabled_at,last_used_step)
       VALUES (?,?,?,?,NULL,NULL)
       ON CONFLICT(admin_user_id) DO UPDATE SET
         encrypted_secret=excluded.encrypted_secret,secret_iv=excluded.secret_iv,
         key_version=excluded.key_version,enabled_at=NULL,last_used_step=NULL,
         updated_at=CURRENT_TIMESTAMP
       WHERE admin_mfa_credentials.enabled_at IS NULL`,
    ).bind(input.adminUserId,input.encryptedSecret,input.secretIv,input.keyVersion).run();
    return result.meta.changes === 1;
  }

  async rotateEncryptedSecret(input: Readonly<{
    adminUserId: string; expectedKeyVersion: number; encryptedSecret: string; secretIv: string; keyVersion: number;
  }>): Promise<void> {
    await this.db.prepare(
      `UPDATE admin_mfa_credentials SET encrypted_secret=?,secret_iv=?,key_version=?,updated_at=CURRENT_TIMESTAMP
       WHERE admin_user_id=? AND key_version=?`,
    ).bind(input.encryptedSecret,input.secretIv,input.keyVersion,input.adminUserId,input.expectedKeyVersion).run();
  }

  async createChallenge(input: Readonly<{
    challengeHash: string; adminUserId: string; purpose: AdminMfaPurpose; expiresAt: string;
  }>): Promise<void> {
    await this.db.prepare("DELETE FROM admin_mfa_challenges WHERE datetime(expires_at)<=CURRENT_TIMESTAMP OR consumed_at IS NOT NULL").run();
    await this.db.prepare(
      "INSERT INTO admin_mfa_challenges(challenge_hash,admin_user_id,purpose,expires_at) VALUES(?,?,?,?)",
    ).bind(input.challengeHash,input.adminUserId,input.purpose,input.expiresAt).run();
  }

  async getChallenge(challengeHash: string): Promise<AdminMfaChallenge | null> {
    const row = await this.db.prepare(
      `SELECT admin_user_id,purpose,attempts FROM admin_mfa_challenges
       WHERE challenge_hash=? AND consumed_at IS NULL AND attempts<5 AND datetime(expires_at)>CURRENT_TIMESTAMP LIMIT 1`,
    ).bind(challengeHash).first<{admin_user_id:string;purpose:AdminMfaPurpose;attempts:number}>();
    return row ? { adminUserId: row.admin_user_id, purpose: row.purpose, attempts: Number(row.attempts) } : null;
  }

  async incrementChallengeAttempts(challengeHash: string): Promise<void> {
    await this.db.prepare(
      `UPDATE admin_mfa_challenges SET attempts=MIN(attempts+1,5)
       WHERE challenge_hash=? AND consumed_at IS NULL AND datetime(expires_at)>CURRENT_TIMESTAMP`,
    ).bind(challengeHash).run();
  }

  async consumeChallenge(challengeHash: string): Promise<boolean> {
    const result = await this.db.prepare(
      `UPDATE admin_mfa_challenges SET consumed_at=CURRENT_TIMESTAMP
       WHERE challenge_hash=? AND consumed_at IS NULL AND attempts<5 AND datetime(expires_at)>CURRENT_TIMESTAMP`,
    ).bind(challengeHash).run();
    return result.meta.changes === 1;
  }

  async advanceTotpStep(adminUserId: string, step: number): Promise<boolean> {
    const result = await this.db.prepare(
      `UPDATE admin_mfa_credentials SET last_used_step=?,updated_at=CURRENT_TIMESTAMP
       WHERE admin_user_id=? AND enabled_at IS NOT NULL
         AND (last_used_step IS NULL OR last_used_step<?)`,
    ).bind(step,adminUserId,step).run();
    return result.meta.changes === 1;
  }

  async enableAfterEnrollment(adminUserId: string, step: number, enabledAt: string): Promise<boolean> {
    const result = await this.db.prepare(
      `UPDATE admin_mfa_credentials SET enabled_at=?,last_used_step=?,updated_at=CURRENT_TIMESTAMP
       WHERE admin_user_id=? AND enabled_at IS NULL
         AND (last_used_step IS NULL OR last_used_step<?)`,
    ).bind(enabledAt,step,adminUserId,step).run();
    return result.meta.changes === 1;
  }

  async consumeRecoveryCode(adminUserId: string, codeHash: string): Promise<boolean> {
    const result = await this.db.prepare(
      `UPDATE admin_mfa_recovery_codes SET used_at=CURRENT_TIMESTAMP
       WHERE admin_user_id=? AND code_hash=? AND used_at IS NULL`,
    ).bind(adminUserId,codeHash).run();
    return result.meta.changes === 1;
  }

  async replaceRecoveryCodes(adminUserId: string, codeHashes: readonly string[]): Promise<void> {
    const statements = [
      this.db.prepare("DELETE FROM admin_mfa_recovery_codes WHERE admin_user_id=?").bind(adminUserId),
      ...codeHashes.map((codeHash) => this.db.prepare(
        "INSERT INTO admin_mfa_recovery_codes(id,admin_user_id,code_hash) VALUES(?,?,?)",
      ).bind(crypto.randomUUID(),adminUserId,codeHash)),
    ];
    await this.db.batch(statements);
  }

  async recoveryCodeCount(adminUserId: string): Promise<number> {
    const row = await this.db.prepare(
      "SELECT COUNT(*) AS count FROM admin_mfa_recovery_codes WHERE admin_user_id=? AND used_at IS NULL",
    ).bind(adminUserId).first<{count:number}>();
    return Number(row?.count ?? 0);
  }

  async disable(adminUserId: string): Promise<void> {
    await this.db.batch([
      this.db.prepare("DELETE FROM admin_mfa_recovery_codes WHERE admin_user_id=?").bind(adminUserId),
      this.db.prepare("DELETE FROM admin_mfa_challenges WHERE admin_user_id=?").bind(adminUserId),
      this.db.prepare("DELETE FROM admin_mfa_credentials WHERE admin_user_id=?").bind(adminUserId),
      this.db.prepare("DELETE FROM admin_step_up_grants WHERE admin_user_id=?").bind(adminUserId),
      this.db.prepare("UPDATE admin_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE admin_user_id=? AND revoked_at IS NULL").bind(adminUserId),
    ]);
  }
}
