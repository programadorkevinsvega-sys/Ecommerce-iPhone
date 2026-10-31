import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { commerceContext } from "../../../lib/commerce";
import { analyticsApp } from "../../../lib/analyticsApplication";
import {
  ensureAnalyticsContext,
  analyticsSetCookie,
  ANALYTICS_SESSION_COOKIE,
  ANALYTICS_VISITOR_COOKIE,
} from "../../../lib/analyticsContext";
import { cloudflareEnv } from "../../../lib/cloudflareContext";
import { cloudflareWaitUntil } from "../../../lib/cloudflareContext";
import { logServerError } from "../../../lib/serverLogger";

const GENERIC_ERROR = "No pudimos completar la operación.";
const VALIDATION_ERROR = "Revisa los datos ingresados e inténtalo nuevamente.";

function errorResponse(error: unknown): Response {
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: VALIDATION_ERROR },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  const code = error instanceof Error ? error.message.toUpperCase() : "UNKNOWN";
  let status = 500;
  if (code.includes("RATE_LIMIT") || code.includes("TOO_MANY")) {
    status = 429;
  } else if (code.includes("UNAUTHORIZED") || code.includes("SESSION")) {
    status = 401;
  } else if (code.includes("FORBIDDEN") || code.includes("PERMISSION")) {
    status = 403;
  } else if (code.includes("NOT_FOUND") || code.includes("NOT FOUND")) {
    status = 404;
  } else if (
    code.includes("CONFLICT") ||
    code.includes("ALREADY") ||
    code.includes("STOCK") ||
    code.includes("UNAVAILABLE")
  ) {
    status = 409;
  } else if (code.includes("INVALID") || code.includes("VALIDATION")) {
    status = 422;
  }
  const message =
    status === 401
      ? "Tu sesión ya no es válida. Inicia sesión nuevamente."
      : status === 403
        ? "No tienes autorización para realizar esta operación."
        : status === 404
          ? "No encontramos el recurso solicitado."
          : status === 409
            ? "La operación entra en conflicto con el estado actual."
            : status === 422
              ? VALIDATION_ERROR
              : status === 429
                ? "Demasiadas solicitudes. Inténtalo nuevamente en unos minutos."
                : GENERIC_ERROR;
  return NextResponse.json(
    { error: message },
    { status, headers: { "cache-control": "no-store" } },
  );
}

async function cartId() {
  const jar = await cookies();
  return jar.get("cart_id")?.value ?? crypto.randomUUID();
}

function setCartCookie(response: NextResponse, id: string) {
  response.cookies.set("cart_id", id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function authorizedCartContext() {
  const id = await cartId();
  const context = await commerceContext();
  const token = (await cookies()).get("customer_session")?.value;
  const session = token ? await context.customerSession.resolve(token) : null;
  if (session) await context.cart.claim(id, session.customerId);
  return { id, context };
}

export async function GET(request: Request) {
  try {
    const { id, context } = await authorizedCartContext();
    const result = await context.cart.get(id);
    const response = NextResponse.json(result, { headers: { "cache-control": "no-store" } });
    if (!(await cookies()).get("cart_id")) setCartCookie(response, id);
    const analytics = ensureAnalyticsContext(request);
    if (analytics.setCookies) {
      response.headers.append(
        "Set-Cookie",
        analyticsSetCookie(ANALYTICS_VISITOR_COOKIE, analytics.visitorId, 31536000),
      );
      response.headers.append(
        "Set-Cookie",
        analyticsSetCookie(ANALYTICS_SESSION_COOKIE, analytics.sessionId, 1800),
      );
    }
    return response;
  } catch (error) {
    logServerError("cart.get", error, {
      requestId: request.headers.get("x-request-id")?.trim() || undefined,
    });
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      productId?: string;
      quantity?: number;
      variantId?: string;
    };
    if (!body.productId || body.quantity === undefined)
      return NextResponse.json({ error: VALIDATION_ERROR }, { status: 422 });
    const { id, context } = await authorizedCartContext();
    const result = await context.cart.addItem({
      cartId: id,
      productId: body.productId,
      quantity: body.quantity,
      ...(body.variantId ? { variantId: body.variantId } : {}),
    });
    const analytics = ensureAnalyticsContext(request);
    cloudflareWaitUntil(
      analyticsApp(cloudflareEnv())
        .record({
          eventId: crypto.randomUUID(),
          eventType: "CartItemAdded",
          source: "server",
          occurredAt: new Date().toISOString(),
          sessionId: analytics.sessionId,
          visitorId: analytics.visitorId,
          requestId: request.headers.get("x-request-id")?.trim() || undefined,
          payload: {
            productId: body.productId,
            quantity: body.quantity,
            ...(body.variantId ? { variantId: body.variantId } : {}),
          },
        })
        .catch(() => undefined),
    );
    const response = NextResponse.json(result, { headers: { "cache-control": "no-store" } });
    if (!(await cookies()).get("cart_id")) setCartCookie(response, id);
    return response;
  } catch (error) {
    logServerError("cart.add_item", error, {
      requestId: request.headers.get("x-request-id")?.trim() || undefined,
      productId: undefined,
    });
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { productId?: string; variantId?: string };
    if (!body.productId) return NextResponse.json({ error: VALIDATION_ERROR }, { status: 422 });
    const { id, context } = await authorizedCartContext();
    const result = await context.cart.removeItem({
      cartId: id,
      productId: body.productId,
      ...(body.variantId ? { variantId: body.variantId } : {}),
    });
    const analytics = ensureAnalyticsContext(request);
    cloudflareWaitUntil(
      analyticsApp(cloudflareEnv())
        .record({
          eventId: crypto.randomUUID(),
          eventType: "CartItemRemoved",
          source: "server",
          occurredAt: new Date().toISOString(),
          sessionId: analytics.sessionId,
          visitorId: analytics.visitorId,
          requestId: request.headers.get("x-request-id")?.trim() || undefined,
          payload: {
            productId: body.productId,
            ...(body.variantId ? { variantId: body.variantId } : {}),
          },
        })
        .catch(() => undefined),
    );
    const response = NextResponse.json(result, { headers: { "cache-control": "no-store" } });
    if (analytics.setCookies) {
      response.headers.append(
        "Set-Cookie",
        analyticsSetCookie(ANALYTICS_VISITOR_COOKIE, analytics.visitorId, 31536000),
      );
      response.headers.append(
        "Set-Cookie",
        analyticsSetCookie(ANALYTICS_SESSION_COOKIE, analytics.sessionId, 1800),
      );
    }
    return response;
  } catch (error) {
    logServerError("cart.remove_item", error, {
      requestId: request.headers.get("x-request-id")?.trim() || undefined,
    });
    return errorResponse(error);
  }
}
