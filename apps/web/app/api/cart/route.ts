import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { commerceContext } from "../../../lib/commerce";

async function cartId() {
  const jar = await cookies();
  return jar.get("cart_id")?.value ?? crypto.randomUUID();
}

function setCartCookie(response: NextResponse, id: string) {
  response.cookies.set("cart_id", id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

function errorResponse(error: unknown, fallback: string, status: number) {
  return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status });
}

export async function GET() {
  try {
    const id = await cartId();
    const { cart } = await commerceContext();
    const result = await cart.get(id);
    const response = NextResponse.json(result);
    if (!(await cookies()).get("cart_id")) setCartCookie(response, id);
    return response;
  } catch (error) {
    return errorResponse(error, "Unable to load cart", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { productId?: string; quantity?: number; variantId?: string };
    if (!body.productId || body.quantity === undefined) return NextResponse.json({ error: "productId and quantity are required" }, { status: 400 });
    const id = await cartId();
    const { cart } = await commerceContext();
    const result = await cart.addItem({ cartId: id, productId: body.productId, quantity: body.quantity, ...(body.variantId ? { variantId: body.variantId } : {}) });
    const response = NextResponse.json(result);
    if (!(await cookies()).get("cart_id")) setCartCookie(response, id);
    return response;
  } catch (error) {
    return errorResponse(error, "Unable to update cart", 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { productId?: string; variantId?: string };
    if (!body.productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });
    const id = await cartId();
    const { cart } = await commerceContext();
    return NextResponse.json(await cart.removeItem({ cartId: id, productId: body.productId, ...(body.variantId ? { variantId: body.variantId } : {}) }));
  } catch (error) {
    return errorResponse(error, "Unable to remove item", 400);
  }
}
