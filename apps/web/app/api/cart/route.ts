import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { commerceContext } from "../../../lib/commerce";

const GENERIC_ERROR = "No pudimos completar la operación.";
const VALIDATION_ERROR = "Revisa los datos ingresados e inténtalo nuevamente.";

function errorResponse(error: unknown): Response {
  const code = error instanceof Error ? error.message.toUpperCase() : "UNKNOWN";
  const status = code.includes("RATE_LIMIT") || code.includes("TOO_MANY") ? 429
    : code.includes("UNAUTHORIZED") || code.includes("SESSION") ? 401
    : code.includes("FORBIDDEN") || code.includes("PERMISSION") ? 403
    : code.includes("NOT_FOUND") || code.includes("NOT FOUND") ? 404
    : code.includes("CONFLICT") || code.includes("ALREADY") ? 409
    : code.includes("INVALID") || code.includes("VALIDATION") ? 422
    : 500;
  const message = status === 401 ? "Tu sesión ya no es válida. Inicia sesión nuevamente."
    : status === 403 ? "No tienes autorización para realizar esta operación."
    : status === 404 ? "No encontramos el recurso solicitado."
    : status === 409 ? "La operación entra en conflicto con el estado actual."
    : status === 422 ? VALIDATION_ERROR
    : status === 429 ? "Demasiadas solicitudes. Inténtalo nuevamente en unos minutos."
    : GENERIC_ERROR;
  return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

async function cartId() {
  const jar = await cookies();
  return jar.get("cart_id")?.value ?? crypto.randomUUID();
}

function setCartCookie(response: NextResponse, id: string) {
  response.cookies.set("cart_id", id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

async function authorizedCartContext() {
  const id = await cartId();
  const context = await commerceContext();
  const token = (await cookies()).get("customer_session")?.value;
  const session = token ? await context.customerSession.resolve(token) : null;
  if (session) await context.cart.claim(id, session.customerId);
  return { id, context };
}

export async function GET() {
  try {
    const { id, context } = await authorizedCartContext();
    const result = await context.cart.get(id);
    const response = NextResponse.json(result, { headers: { "cache-control": "no-store" } });
    if (!(await cookies()).get("cart_id")) setCartCookie(response, id);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { productId?: string; quantity?: number; variantId?: string };
    if (!body.productId || body.quantity === undefined) return NextResponse.json({ error: VALIDATION_ERROR }, { status: 422 });
    const { id, context } = await authorizedCartContext();
    const result = await context.cart.addItem({ cartId: id, productId: body.productId, quantity: body.quantity, ...(body.variantId ? { variantId: body.variantId } : {}) });
    const response = NextResponse.json(result, { headers: { "cache-control": "no-store" } });
    if (!(await cookies()).get("cart_id")) setCartCookie(response, id);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { productId?: string; variantId?: string };
    if (!body.productId) return NextResponse.json({ error: VALIDATION_ERROR }, { status: 422 });
    const { id, context } = await authorizedCartContext();
    return NextResponse.json(await context.cart.removeItem({ cartId: id, productId: body.productId, ...(body.variantId ? { variantId: body.variantId } : {}) }), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
