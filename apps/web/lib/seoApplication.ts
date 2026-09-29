import { SeoManagement } from "../../../modules/seo/application/SeoRepository";
import { D1SeoRepository } from "../../../modules/seo/infrastructure/D1SeoRepository";

export function seoManagementApplication(env: CloudflareEnv): SeoManagement {
  return new SeoManagement(new D1SeoRepository(env.DB));
}
