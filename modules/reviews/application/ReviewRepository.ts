import type { Review, ReviewProps } from "../domain/Review";

export type PublicReview = ReviewProps & { id:string; customerName:string };
export interface ReviewRepository {
  listApproved(productId:string):Promise<readonly PublicReview[]>;
  create(review:Review):Promise<void>;
  hasVerifiedPurchase(customerId:string,productId:string,orderId:string):Promise<boolean>;
  exists(customerId:string,productId:string,orderId:string):Promise<boolean>;
}

export class ReviewService {
  constructor(private readonly repository:ReviewRepository) {}
  async list(productId:string){return this.repository.listApproved(productId);}
  async create(input:ReviewProps){
    const verified=await this.repository.hasVerifiedPurchase(input.customerId,input.productId,input.orderId);
    if(!verified) throw new Error("VERIFIED_PURCHASE_REQUIRED");
    if(await this.repository.exists(input.customerId,input.productId,input.orderId)) throw new Error("REVIEW_ALREADY_EXISTS");
    const review=Review.create(crypto.randomUUID(),{...input,verifiedPurchase:true,status:"PENDING"});
    await this.repository.create(review);
    return review.toPrimitives();
  }
}
