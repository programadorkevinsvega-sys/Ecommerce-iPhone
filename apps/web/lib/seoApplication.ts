import { SeoManagement } from "../../../modules/seo/application/SeoRepository";
import { D1SeoRepository } from "../../../modules/seo/infrastructure/D1SeoRepository";
import { D1AuditPort } from "../../../modules/admin/infrastructure/D1AuditPort";

export function seoManagementApplication(env: CloudflareEnv): SeoManagement {
  return new SeoManagement(new D1SeoRepository(env.DB), new D1AuditPort(env.DB));
}
