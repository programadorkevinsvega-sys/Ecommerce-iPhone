import { CreateAdminSession } from "../../../modules/admin/application/CreateAdminSession";
import {
  createRecoveryCodes,
  generateTotpSecret,
  matchTotpStep,
  normalizeRecoveryCode,
  randomMfaToken,
  sha256Hex,
} from "../../../modules/admin/application/AdminMfaCrypto";
import { D1AdminAuthPasswordHasher } from "../../../modules/admin/infrastructure/D1AdminAuthPasswordHasher";
import { D1AdminAuthSessionRepository } from "../../../modules/admin/infrastructure/D1AdminAuthSessionRepository";
import { D1AdminMfaRepository, type AdminMfaCredential } from "../../../modules/admin/infrastructure/D1AdminMfaRepository";
import { D1AdminRepository } from "../../../modules/admin/infrastructure/D1AdminRepository";
import { D1AuditPort } from "../../../modules/admin/infrastructure/D1AuditPort";
import { sha256 } from "../../../modules/admin/infrastructure/AdminSecurity";

type MfaEnvironment = CloudflareEnv & {
  ADMIN_MFA_ENCRYPTION_KEY?: string;
  ADMIN_MFA_ENCRYPTION_KEY_PREVIOUS?: string;
  ADMIN_MFA_ENCRYPTION_KEY_VERSION?: string;
};
export type AdminMfaLoginChallenge = Readonly<{
  token: string;
  expiresAt: Date;
  purpose: "login" | "enroll";
}>;
export type AdminMfaProvisioning = Readonly<{
  purpose: "login" | "enroll";
  secret?: string;
  otpauthUri?: string;
}>;
export type AdminMfaLoginResult = Readonly<{
  admin: Readonly<{ id: string; email: string; role: string; firstName: string; lastName: string }>;
  token: string;
  expiresAt: Date;
  recoveryCodes?: readonly string[];
}>;

const CHALLENGE_TTL_MS = 5 * 60_000;
const ADMIN_SESSION_TTL_MS = 8 * 24 * 60 * 60_000;

function environment(env: CloudflareEnv): MfaEnvironment {
  return env as MfaEnvironment;
}

function activeKeyVersion(env: MfaEnvironment): 1 | 2 {
  const version = env.ADMIN_MFA_ENCRYPTION_KEY_VERSION === undefined
    ? 1
    : Number(env.ADMIN_MFA_ENCRYPTION_KEY_VERSION);
  if (version !== 1 && version !== 2) throw new Error("ADMIN_MFA_CONFIGURATION_INVALID");
  return version;
}

function decodeEncryptionKey(value: string | undefined): Uint8Array {
  if (!value) throw new Error("ADMIN_MFA_CONFIGURATION_REQUIRED");
  let decoded: Uint8Array;
  try {
    const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    decoded = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    throw new Error("ADMIN_MFA_CONFIGURATION_INVALID");
  }
  if (decoded.byteLength !== 32) throw new Error("ADMIN_MFA_CONFIGURATION_INVALID");
  return decoded;
}

async function importAesKey(value: string | undefined): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", decodeEncryptionKey(value), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptTotpSecret(env: MfaEnvironment, secret: string): Promise<Readonly<{
  encryptedSecret: string; secretIv: string; keyVersion: number;
}>> {
  const keyVersion = activeKeyVersion(env);
  const key = await importAesKey(env.ADMIN_MFA_ENCRYPTION_KEY);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(secret));
  const toBase64 = (bytes: Uint8Array) => {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  };
  return { encryptedSecret: toBase64(new Uint8Array(encrypted)), secretIv: toBase64(iv), keyVersion };
}

async function decryptTotpSecret(
  env: MfaEnvironment,
  adminId: string,
  credential: AdminMfaCredential,
  repository: D1AdminMfaRepository,
): Promise<string> {
  const activeVersion = activeKeyVersion(env);
  if (credential.keyVersion !== 1 && credential.keyVersion !== 2) {
    throw new Error("ADMIN_MFA_CONFIGURATION_INVALID");
  }
  if (credential.keyVersion > activeVersion) throw new Error("ADMIN_MFA_CONFIGURATION_INVALID");
  const previousKey = credential.keyVersion < activeVersion
    ? env.ADMIN_MFA_ENCRYPTION_KEY_PREVIOUS
    : undefined;
  const sourceKey = previousKey ?? env.ADMIN_MFA_ENCRYPTION_KEY;
  const key = await importAesKey(sourceKey);
  const fromBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(credential.secretIv) },
      key,
      fromBase64(credential.encryptedSecret),
    );
  } catch {
    throw new Error("ADMIN_MFA_CONFIGURATION_INVALID");
  }
  const secret = new TextDecoder().decode(plaintext);
  if (credential.keyVersion < activeVersion) {
    const rotated = await encryptTotpSecret(env, secret);
    await repository.rotateEncryptedSecret({
      adminUserId: adminId,
      expectedKeyVersion: credential.keyVersion,
      ...rotated,
    });
  }
  return secret;
}

function repositories(env: CloudflareEnv) {
  return {
    admins: new D1AdminRepository(env.DB),
    passwords: new D1AdminAuthPasswordHasher(),
    sessions: new D1AdminAuthSessionRepository(env.DB),
    mfa: new D1AdminMfaRepository(env.DB),
    audit: new D1AuditPort(env.DB),
  };
}

function sessionToken(): string {
  return randomMfaToken();
}

function adminPrincipal(user: Awaited<ReturnType<D1AdminRepository["findById"]>>) {
  if (!user) throw new Error("UNAUTHORIZED");
  const value = user.toPrimitives();
  return {
    id: value.id,
    email: value.email,
    role: value.role,
    firstName: value.firstName,
    lastName: value.lastName,
  };
}

function issueDate(): Date {
  return new Date(Date.now() + CHALLENGE_TTL_MS);
}

async function auditFailure(
  repos: ReturnType<typeof repositories>,
  adminUserId: string,
  action: string,
  reason: string,
): Promise<void> {
  await repos.audit.audit(adminUserId, action, "admin_user", adminUserId, { reason });
}

export async function startAdminMfaLogin(
  envInput: CloudflareEnv,
  input: Readonly<{ email: string; password: string; ipHash?: string; userAgentHash?: string }>,
): Promise<AdminMfaLoginChallenge> {
  const env = environment(envInput);
  activeKeyVersion(env);
  await importAesKey(env.ADMIN_MFA_ENCRYPTION_KEY);
  const repos = repositories(env);
  const email = input.email.trim().toLowerCase();
  const user = await repos.admins.findByEmail(email);
  if (!user) {
    await repos.passwords.verifyUnknownAccount(input.password);
    await repos.audit.audit(null, "ADMIN_LOGIN_FAILED", "admin_user", null, {
      reason: "invalid_credentials",
      ipHash: input.ipHash ?? null,
    });
    throw new Error("INVALID_CREDENTIALS");
  }

  const value = user.toPrimitives();
  const now = new Date();
  if (!value.active) throw new Error("INVALID_CREDENTIALS");
  if (value.lockedUntil && new Date(value.lockedUntil).getTime() > now.getTime()) {
    await auditFailure(repos, value.id, "ADMIN_LOGIN_BLOCKED", "account_locked");
    throw new Error("ACCOUNT_LOCKED");
  }
  if (!(await repos.passwords.verify(input.password, value.passwordHash))) {
    const failure = await repos.admins.recordFailedLogin(value.id, now, 5, 15);
    await repos.audit.audit(value.id, "ADMIN_LOGIN_FAILED", "admin_user", value.id, {
      reason: "invalid_credentials",
      failedLoginCount: failure.failedLoginCount,
      lockedUntil: failure.lockedUntil ?? null,
      ipHash: input.ipHash ?? null,
    });
    if (failure.lockedUntil && new Date(failure.lockedUntil).getTime() > now.getTime()) {
      throw new Error("ACCOUNT_LOCKED");
    }
    throw new Error("INVALID_CREDENTIALS");
  }

  let purpose: "login" | "enroll" = "login";
  const credential = await repos.mfa.getCredential(value.id);
  if (!credential?.enabledAt) {
    purpose = "enroll";
    const secret = generateTotpSecret();
    const encrypted = await encryptTotpSecret(env, secret);
    const stored = await repos.mfa.savePendingCredential({
      adminUserId: value.id,
      ...encrypted,
    });
    if (!stored) throw new Error("MFA_ENROLLMENT_CONFLICT");
  }

  const token = sessionToken();
  const expiresAt = issueDate();
  await repos.mfa.createChallenge({
    challengeHash: await sha256Hex(token),
    adminUserId: value.id,
    purpose,
    expiresAt: expiresAt.toISOString(),
  });
  await repos.audit.audit(value.id, "ADMIN_MFA_CHALLENGE_ISSUED", "admin_user", value.id, {
    purpose,
    expiresAt: expiresAt.toISOString(),
    ipHash: input.ipHash ?? null,
  });
  return { token, expiresAt, purpose };
}

export async function readAdminMfaChallenge(
  envInput: CloudflareEnv,
  token: string,
): Promise<AdminMfaProvisioning> {
  const env = environment(envInput);
  const repos = repositories(env);
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) throw new Error("MFA_CHALLENGE_INVALID");
  const challenge = await repos.mfa.getChallenge(await sha256Hex(token));
  if (!challenge) throw new Error("MFA_CHALLENGE_INVALID");
  if (challenge.purpose === "login") {
    const credential = await repos.mfa.getCredential(challenge.adminUserId);
    if (!credential?.enabledAt) throw new Error("MFA_CHALLENGE_INVALID");
    await decryptTotpSecret(env, challenge.adminUserId, credential, repos.mfa);
    return { purpose: "login" };
  }

  const credential = await repos.mfa.getCredential(challenge.adminUserId);
  if (!credential || credential.enabledAt) throw new Error("MFA_CHALLENGE_INVALID");
  const secret = await decryptTotpSecret(env, challenge.adminUserId, credential, repos.mfa);
  const label = `Ecommerce iPhone:${challenge.adminUserId.slice(0, 8)}`;
  const issuer = "Ecommerce iPhone";
  const otpauthUri = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  return {
    purpose: "enroll",
    secret,
    otpauthUri,
  };
}

async function recordMfaFailure(
  repos: ReturnType<typeof repositories>,
  adminUserId: string,
  challengeHash?: string,
): Promise<void> {
  if (challengeHash) await repos.mfa.incrementChallengeAttempts(challengeHash);
  const now = new Date();
  const failure = await repos.admins.recordFailedLogin(adminUserId, now, 5, 15);
  await repos.audit.audit(adminUserId, "ADMIN_MFA_VERIFICATION_FAILED", "admin_user", adminUserId, {
    failedLoginCount: failure.failedLoginCount,
    lockedUntil: failure.lockedUntil ?? null,
  });
}

async function finishAuthenticatedSession(
  env: CloudflareEnv,
  adminUserId: string,
  fingerprint: Readonly<{ ipHash?: string; userAgentHash?: string }>,
): Promise<Readonly<{ admin: AdminMfaLoginResult["admin"]; token: string; expiresAt: Date }>> {
  const repos = repositories(env);
  const user = await repos.admins.findById(adminUserId);
  if (!user || !user.toPrimitives().active) throw new Error("UNAUTHORIZED");
  const now = new Date();
  const current = user.toPrimitives();
  if (current.lockedUntil && new Date(current.lockedUntil).getTime() > now.getTime()) {
    throw new Error("ACCOUNT_LOCKED");
  }
  await repos.admins.recordSuccessfulLogin(adminUserId, now);
  await repos.sessions.revokeAll(adminUserId);
  const token = sessionToken();
  const expiresAt = new Date(now.getTime() + ADMIN_SESSION_TTL_MS);
  await new CreateAdminSession(repos.sessions, sha256).execute(
    adminUserId,
    token,
    expiresAt,
    fingerprint.ipHash,
    fingerprint.userAgentHash,
  );
  return { admin: adminPrincipal(user), token, expiresAt };
}

export async function completeAdminMfaLogin(
  envInput: CloudflareEnv,
  input: Readonly<{
    challengeToken: string;
    code: string;
    ipHash?: string;
    userAgentHash?: string;
  }>,
): Promise<AdminMfaLoginResult> {
  const env = environment(envInput);
  const repos = repositories(env);
  const challengeHash = await sha256Hex(input.challengeToken);
  const challenge = await repos.mfa.getChallenge(challengeHash);
  if (!challenge) throw new Error("MFA_CHALLENGE_INVALID");
  const account = await repos.admins.findById(challenge.adminUserId);
  if (!account || !account.toPrimitives().active) throw new Error("UNAUTHORIZED");
  const lockedUntil = account.toPrimitives().lockedUntil;
  if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) throw new Error("ACCOUNT_LOCKED");
  const credential = await repos.mfa.getCredential(challenge.adminUserId);
  if (!credential) throw new Error("MFA_CHALLENGE_INVALID");
  const secret = await decryptTotpSecret(env, challenge.adminUserId, credential, repos.mfa);

  let matchedStep: number | null = null;
  let recoveryUsed = false;
  if (challenge.purpose === "enroll") {
    if (credential.enabledAt) throw new Error("MFA_CHALLENGE_INVALID");
    matchedStep = await matchTotpStep(secret, input.code, Date.now(), credential.lastUsedStep);
  } else {
    if (!credential.enabledAt) throw new Error("MFA_CHALLENGE_INVALID");
    matchedStep = await matchTotpStep(secret, input.code, Date.now(), credential.lastUsedStep);
    if (matchedStep === null) {
      const normalized = normalizeRecoveryCode(input.code);
      if (normalized) recoveryUsed = await repos.mfa.consumeRecoveryCode(
        challenge.adminUserId,
        await sha256Hex(normalized),
      );
    }
  }

  if (matchedStep === null && !recoveryUsed) {
    await recordMfaFailure(repos, challenge.adminUserId, challengeHash);
    throw new Error("INVALID_MFA_CODE");
  }

  if (!(await repos.mfa.consumeChallenge(challengeHash))) {
    throw new Error("MFA_CHALLENGE_INVALID");
  }
  if (matchedStep !== null) {
    const updated = challenge.purpose === "enroll"
      ? await repos.mfa.enableAfterEnrollment(challenge.adminUserId, matchedStep, new Date().toISOString())
      : await repos.mfa.advanceTotpStep(challenge.adminUserId, matchedStep);
    if (!updated) throw new Error("MFA_CODE_REUSED");
  }

  let recoveryCodes: string[] | undefined;
  if (challenge.purpose === "enroll") {
    recoveryCodes = createRecoveryCodes(10);
    await repos.mfa.replaceRecoveryCodes(
      challenge.adminUserId,
      await Promise.all(recoveryCodes.map((code) => sha256Hex(normalizeRecoveryCode(code)!))),
    );
  }
  const session = await finishAuthenticatedSession(env, challenge.adminUserId, input);
  if (challenge.purpose === "enroll") {
    await repos.audit.audit(challenge.adminUserId, "ADMIN_MFA_ENROLLED", "admin_user", challenge.adminUserId, {
      recoveryCodeCount: recoveryCodes?.length ?? 0,
    });
  } else {
    await repos.audit.audit(challenge.adminUserId, "ADMIN_LOGIN_MFA_SUCCESS", "admin_user", challenge.adminUserId, {
      recoveryCodeUsed: recoveryUsed,
      ipHash: input.ipHash ?? null,
    });
  }
  return {
    ...session,
    ...(recoveryCodes ? { recoveryCodes } : {}),
  };
}

export async function verifyAdminPasswordForPrivilegedAction(
  env: CloudflareEnv,
  adminUserId: string,
  password: string,
): Promise<void> {
  if (!password || password.length > 128) throw new Error("INVALID_CREDENTIALS");
  const repos = repositories(env);
  const admin = await repos.admins.findById(adminUserId);
  if (!admin || !admin.toPrimitives().active) throw new Error("UNAUTHORIZED");
  const current = admin.toPrimitives();
  const now = new Date();
  if (current.lockedUntil && new Date(current.lockedUntil).getTime() > now.getTime()) {
    await auditFailure(repos, adminUserId, "ADMIN_MFA_MANAGEMENT_BLOCKED", "account_locked");
    throw new Error("ACCOUNT_LOCKED");
  }
  const valid = await repos.passwords.verify(password, current.passwordHash);
  if (!valid) {
    await repos.admins.recordFailedLogin(adminUserId, now, 5, 15);
    await repos.audit.audit(adminUserId, "ADMIN_MFA_MANAGEMENT_FAILED", "admin_user", adminUserId, {
      reason: "invalid_credentials",
    });
    throw new Error("INVALID_CREDENTIALS");
  }
}

export async function verifyAdminMfaFactor(
  envInput: CloudflareEnv,
  adminUserId: string,
  code: string,
): Promise<void> {
  const env = environment(envInput);
  const repos = repositories(env);
  const admin = await repos.admins.findById(adminUserId);
  if (!admin || !admin.toPrimitives().active) throw new Error("UNAUTHORIZED");
  const lockedUntil = admin.toPrimitives().lockedUntil;
  if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) throw new Error("ACCOUNT_LOCKED");
  const credential = await repos.mfa.getCredential(adminUserId);
  if (!credential?.enabledAt) throw new Error("ADMIN_MFA_REQUIRED");
  const secret = await decryptTotpSecret(env, adminUserId, credential, repos.mfa);
  const matchedStep = await matchTotpStep(secret, code, Date.now(), credential.lastUsedStep);
  if (matchedStep !== null) {
    if (!(await repos.mfa.advanceTotpStep(adminUserId, matchedStep))) throw new Error("MFA_CODE_REUSED");
    return;
  }
  const normalized = normalizeRecoveryCode(code);
  if (normalized && await repos.mfa.consumeRecoveryCode(adminUserId, await sha256Hex(normalized))) return;
  await recordMfaFailure(repos, adminUserId);
  throw new Error("INVALID_MFA_CODE");
}

export async function getAdminMfaStatus(
  env: CloudflareEnv,
  adminUserId: string,
): Promise<Readonly<{ enabled: boolean; recoveryCodesRemaining: number }>> {
  const repos = repositories(env);
  const credential = await repos.mfa.getCredential(adminUserId);
  return {
    enabled: Boolean(credential?.enabledAt),
    recoveryCodesRemaining: credential?.enabledAt ? await repos.mfa.recoveryCodeCount(adminUserId) : 0,
  };
}

export async function regenerateAdminMfaRecoveryCodes(
  env: CloudflareEnv,
  input: Readonly<{ adminUserId: string; password: string; code: string }>,
): Promise<readonly string[]> {
  await verifyAdminPasswordForPrivilegedAction(env, input.adminUserId, input.password);
  await verifyAdminMfaFactor(env, input.adminUserId, input.code);
  const codes = createRecoveryCodes(10);
  const repos = repositories(env);
  await repos.mfa.replaceRecoveryCodes(
    input.adminUserId,
    await Promise.all(codes.map((code) => sha256Hex(normalizeRecoveryCode(code)!))),
  );
  await repos.audit.audit(input.adminUserId, "ADMIN_MFA_RECOVERY_CODES_REGENERATED", "admin_user", input.adminUserId, {
    recoveryCodeCount: codes.length,
  });
  return codes;
}

export async function disableAdminMfa(
  env: CloudflareEnv,
  input: Readonly<{ adminUserId: string; password: string; code: string }>,
): Promise<void> {
  await verifyAdminPasswordForPrivilegedAction(env, input.adminUserId, input.password);
  await verifyAdminMfaFactor(env, input.adminUserId, input.code);
  const repos = repositories(env);
  await repos.audit.audit(input.adminUserId, "ADMIN_MFA_DISABLED", "admin_user", input.adminUserId, {
    sessionsRevoked: true,
    stepUpGrantsRevoked: true,
  });
  await repos.mfa.disable(input.adminUserId);
}
