import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { reviewService } from "../../../../../lib/storefrontReviews";
import { assertLength, normalizeIdentifier, normalizeMultiline, normalizeSingleLine, validateRating } from "../../../../../lib/inputValidation";

function errorResponse(error: unknown): Response {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const messages: Record<string, string> = {
    INVALID_ORDERID: "Invalid order reference",
    INVALID_REVIEWBODY: "Review must contain between 10 and 3000 characters",
    INVALID_REVIEW_RATING: "Rating must be an integer from 1 to 5",
    INVALID_RATING: "Rating must be an integer from 1 to 5",
    VERIFIED_PURCHASE_REQUIRED: "A verified purchase is required to review this product",
    REVIEW_ALREADY_EXISTS: "A review for this purchase already exists",
  };
  const status = code === "VERIFIED_PURCHASE_REQUIRED" ? 403 : code === "REVIEW_ALREADY_EXISTS" ? 409 : 400;
  return NextResponse.json({ error: messages[code] ?? "Unable to submit review" }, { status });
}

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;
    if(!id) return NextResponse.json({error:"Product id is required"},{status:400});
    return NextResponse.json({reviews:await (await reviewService()).list(id)});
  } catch {
    return NextResponse.json({error:"Unable to load reviews"},{status:500});
  }
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;
    const customerId=(await cookies()).get("customer_id")?.value;
    if(!customerId) return NextResponse.json({error:"Customer session required"},{status:401});
    const body=await request.json() as Record<string,unknown>;
    const orderId=assertLength(normalizeIdentifier(body.orderId),"orderId");
    const rating=validateRating(body.rating);
    const reviewBody=assertLength(normalizeMultiline(body.body),"reviewBody");
    const title=normalizeSingleLine(body.title);
    const reviewInput={productId:id,customerId,orderId,rating,body:reviewBody,status:"PENDING" as const,verifiedPurchase:true,...(title?{title:assertLength(title,"reviewTitle")}:{})};
    const review=await (await reviewService()).create(reviewInput);
    return NextResponse.json({review},{status:201});
  } catch(error) {
    return errorResponse(error);
  }
}
