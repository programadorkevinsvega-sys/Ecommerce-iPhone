import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1ReviewRepository } from "../../../modules/reviews/infrastructure/D1ReviewRepository";
import { ReviewService } from "../../../modules/reviews/application/ReviewRepository";

export async function reviewService(){const {env}=getCloudflareContext();return new ReviewService(new D1ReviewRepository(env.DB));}
export async function listProductReviews(productId:string){return (await reviewService()).list(productId);}
