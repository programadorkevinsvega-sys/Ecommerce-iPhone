import {D1PublicMarketingRepository} from "../../../modules/cms/infrastructure/D1PublicMarketingRepository";
import {PublicContent} from "../../../modules/cms/application/PublicContent";
import {getCloudflareContext} from "@opennextjs/cloudflare";
export async function publicContent(){const {env}=await getCloudflareContext({async:true});return new PublicContent(new D1PublicMarketingRepository(env.DB));}
