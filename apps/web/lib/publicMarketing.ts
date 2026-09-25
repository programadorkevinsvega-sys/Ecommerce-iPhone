import {getCloudflareContext} from "@opennextjs/cloudflare";
import {D1PublicMarketingRepository} from "../../../modules/cms/infrastructure/D1PublicMarketingRepository";
import {PublicMarketing} from "../../../modules/cms/application/PublicMarketing";
export async function publicMarketing(){const {env}=await getCloudflareContext({async:true});return new PublicMarketing(new D1PublicMarketingRepository(env.DB));}
