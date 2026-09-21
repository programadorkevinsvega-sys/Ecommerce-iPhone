import { AuthenticateAdminAtomic } from "../../../modules/admin/application/AuthenticateAdminAtomic";
import { BootstrapAdmin } from "../../../modules/admin/application/BootstrapAdmin";
import { CreateAdminSession } from "../../../modules/admin/application/CreateAdminSession";
import { LogoutAdmin } from "../../../modules/admin/application/LogoutAdmin";
import { ResolveCurrentAdmin } from "../../../modules/admin/application/ResolveCurrentAdmin";
import { RequireAdmin } from "../../../modules/admin/application/RequireAdmin";
import { D1AdminAuthPasswordHasher } from "../../../modules/admin/infrastructure/D1AdminAuthPasswordHasher";
import { D1AdminAuthRepository } from "../../../modules/admin/infrastructure/D1AdminAuthRepository";
import { D1AdminAuthSessionRepository } from "../../../modules/admin/infrastructure/D1AdminAuthSessionRepository";
import { D1AuditPort } from "../../../modules/admin/infrastructure/D1AuditPort";
import { sha256 } from "../../../modules/admin/infrastructure/AdminSecurity";
import { D1AdminPermissionRepository } from "../../../modules/admin/infrastructure/D1AdminPermissionRepository";

function sessions(env: CloudflareEnv) { return new D1AdminAuthSessionRepository(env.DB); }
export function buildAuthenticateAdmin(env: CloudflareEnv) {
  const sessionRepository=sessions(env);
  return new AuthenticateAdminAtomic(new D1AdminAuthRepository(env.DB),sessionRepository,new D1AdminAuthPasswordHasher(),new D1AuditPort(env.DB),new CreateAdminSession(sessionRepository,sha256));
}
export function buildResolveCurrentAdmin(env: CloudflareEnv) { return new ResolveCurrentAdmin(sessions(env),sha256,new D1AdminPermissionRepository(env.DB)); }
export function buildRequireAdmin(env: CloudflareEnv) { return new RequireAdmin(buildResolveCurrentAdmin(env)); }
export function buildLogoutAdmin(env: CloudflareEnv) { return new LogoutAdmin(sessions(env),new D1AuditPort(env.DB),sha256); }
export function buildBootstrapAdmin(env: CloudflareEnv) { return new BootstrapAdmin(new D1AdminAuthRepository(env.DB),new D1AdminAuthPasswordHasher(),new D1AuditPort(env.DB)); }
