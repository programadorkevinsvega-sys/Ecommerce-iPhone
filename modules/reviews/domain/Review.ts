import { DomainError } from "../../shared-kernel";

export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ReviewProps = Readonly<{ productId:string; customerId:string; orderId:string; rating:number; title?:string; body:string; status:ReviewStatus; verifiedPurchase:boolean; adminResponse?:string }>;

export class Review {
  private constructor(private readonly id:string,private readonly props:ReviewProps) {}
  static create(id:string,props:ReviewProps):Review {
    if(!Number.isInteger(props.rating)||props.rating<1||props.rating>5) throw new DomainError("INVALID_REVIEW_RATING");
    if(!props.body.trim()||props.body.trim().length>3000) throw new DomainError("INVALID_REVIEW_BODY");
    if(props.title&&props.title.length>160) throw new DomainError("INVALID_REVIEW_TITLE");
    return new Review(id,{...props,body:props.body.trim(),title:props.title?.trim()||undefined});
  }
  getId(){return this.id;}
  toPrimitives(){return {id:this.id,...this.props};}
}
