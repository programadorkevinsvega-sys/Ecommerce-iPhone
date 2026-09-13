import { AuthenticateAdmin } from "../../../modules/admin/application/AuthenticateAdmin";
import { BootstrapAdmin } from "../../../modules/admin/application/BootstrapAdmin";
import { LogoutAdmin } from "../../../modules/admin/application/LogoutAdmin";
import { ResolveCurrentAdmin } from "../../../modules/admin/application/ResolveCurrentAdmin";
import { RequireAdmin } from "../../../modules/admin/application/RequireAdmin";
import { D1AdminAuthPasswordHasher } from "../../../modules/admin/infrastructure/D1AdminAuthPasswordHasher";
import { D1AdminAuthRepository } from "../../../modules/admin/infrastructure/D1AdminAuthRepository";
import { D1AdminAuthSessionRepository } from "../../../modules/admin/infrastructure/D1AdminAuthSessionRepository";
import { D1AuditPort } from "../../../modules/admin/infrastructure/D1AuditPort";
import { sha256 } from "../../../modules/admin/infrastructure/AdminSecurity";

export function buildAuthenticateAdmin(env: CloudflareEnv) {
  return new AuthenticateAdmin(
    new D1AdminAuthRepository(env.DB),
    new D1AdminAuthSessionRepository(env.DB),
    new D1AdminAuthPasswordHasher(),
    new D1AuditPort(env.DB),
    sha256,
  );
}

export function buildResolveCurrentAdmin(env: CloudflareEnv) {
  return new ResolveCurrentAdmin(new D1AdminAuthSessionRepository(env.DB), sha256);
}

export function buildRequireAdmin(env: CloudflareEnv) {
  return new RequireAdmin(buildResolveCurrentAdmin(env));
}

export function buildLogoutAdmin(env: CloudflareEnv) {
  return new LogoutAdmin(new D1AdminAuthSessionRepository(env.DB), new D1AuditPort(env.DB), sha256);
}

export function buildBootstrapAdmin(env: CloudflareEnv) {
  return new BootstrapAdmin(
    new D1AdminAuthRepository(env.DB),
    new D1AdminAuthPasswordHasher(),
    new D1AuditPort(env.DB),
  );
}
