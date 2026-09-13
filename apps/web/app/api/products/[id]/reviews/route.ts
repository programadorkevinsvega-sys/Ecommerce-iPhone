import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { reviewService } from "../../../../../lib/storefrontReviews";
import { assertLength, normalizeIdentifier, normalizeMultiline, normalizeSingleLine, validateRating } from "../../../../../lib/inputValidation";

function errorResponse(error: unknown): Response {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const messages: Record<string, string> = {
    INVALID_ORDERID: "Revisa los datos ingresados e inténtalo nuevamente.",
    INVALID_REVIEWBODY: "Revisa los datos ingresados e inténtalo nuevamente.",
    INVALID_REVIEW_RATING: "Revisa los datos ingresados e inténtalo nuevamente.",
    INVALID_RATING: "Revisa los datos ingresados e inténtalo nuevamente.",
    VERIFIED_PURCHASE_REQUIRED: "Necesitas una compra verificada para publicar una reseña.",
    REVIEW_ALREADY_EXISTS: "Ya existe una reseña para esta compra.",
  };
  const normalized = code.toUpperCase();
  const status = normalized === "VERIFIED_PURCHASE_REQUIRED" ? 403 : normalized === "REVIEW_ALREADY_EXISTS" ? 409 : normalized.includes("RATE_LIMIT") ? 429 : normalized.startsWith("INVALID_") || normalized.includes("VALIDATION") ? 422 : 500;
  return NextResponse.json({ error: messages[code] ?? (status === 429 ? "Demasiadas solicitudes. Inténtalo nuevamente en unos minutos." : "No pudimos completar la operación.") }, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Revisa los datos ingresados e inténtalo nuevamente." }, { status: 422 });
    return NextResponse.json({ reviews: await (await reviewService()).list(id) }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No pudimos completar la operación." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const customerId = (await cookies()).get("customer_id")?.value;
    if (!customerId) return NextResponse.json({ error: "Tu sesión ya no es válida. Inicia sesión nuevamente." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const orderId = assertLength(normalizeIdentifier(body.orderId), "orderId");
    const rating = validateRating(body.rating);
    const reviewBody = assertLength(normalizeMultiline(body.body), "reviewBody");
    const title = normalizeSingleLine(body.title);
    const reviewInput = { productId: id, customerId, orderId, rating, body: reviewBody, status: "PENDING" as const, verifiedPurchase: true, ...(title ? { title: assertLength(title, "reviewTitle") } : {}) };
    const review = await (await reviewService()).create(reviewInput);
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
