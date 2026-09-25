import type { AuditPort } from "../../admin/application/AuditPort";
import { assertModerationTransition, type ReviewModerationStatus } from "../domain/ReviewModeration";

export type AdminReview = Readonly<{
  id:string;
  productId:string;
  customerId:string;
  orderId:string;
  rating:number;
  title:string|null;
  body:string;
  status:ReviewModerationStatus;
  verifiedPurchase:boolean|number;
  adminResponse:string|null;
  createdAt:string;
  updatedAt:string;
  productName:string;
}>;

export type ReviewRepository = {
  list(status?:string,productId?:string,limit?:number,offset?:number):Promise<readonly AdminReview[]>;
  getStatus(id:string):Promise<ReviewModerationStatus|null>;
  moderate(id:string,from:ReviewModerationStatus,status:ReviewModerationStatus,response?:string):Promise<boolean>;
};

export class AdminReviews {
  constructor(private readonly repository:ReviewRepository,private readonly audit:AuditPort) {}

  list(status?:string,productId?:string,limit=50,offset=0):Promise<readonly AdminReview[]> {
    if(status&&!["PENDING","APPROVED","REJECTED"].includes(status)) throw new Error("INVALID_REVIEW_STATUS");
    return this.repository.list(status,productId?.trim()||undefined,Math.min(Math.max(limit,1),100),Math.max(offset,0));
  }

  async moderate(id:string,status:"APPROVED"|"REJECTED",response:string|undefined,adminUserId:string):Promise<boolean> {
    const reviewId=id.trim();
    const value=response?.trim();
    if(!reviewId||!["APPROVED","REJECTED"].includes(status)||(value!==undefined&&value.length>2000)) throw new Error("INVALID_REVIEW_MODERATION");
    const current=await this.repository.getStatus(reviewId);
    if(!current) throw new Error("REVIEW_NOT_FOUND");
    assertModerationTransition(current,status);
    const updated=await this.repository.moderate(reviewId,current,status,value||undefined);
    if(!updated) throw new Error("REVIEW_MODERATION_CONFLICT");
    await this.audit.audit(adminUserId,"ADMIN_REVIEW_MODERATED","product_review",reviewId,{from:current,to:status});
    return true;
  }
}
