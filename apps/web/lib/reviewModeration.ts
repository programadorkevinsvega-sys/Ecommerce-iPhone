import {getCloudflareContext} from "@opennextjs/cloudflare";
import {ReviewModeration} from "../../../modules/reviews/application/ReviewModeration";
import {D1ReviewModerationRepository} from "../../../modules/reviews/infrastructure/D1ReviewModerationRepository";
import {D1AuditPort} from "../../../modules/admin/infrastructure/D1AuditPort";
export async function reviewModerationApplication(){const {env}=await getCloudflareContext({async:true});return new ReviewModeration(new D1ReviewModerationRepository(env.DB),new D1AuditPort(env.DB));}
