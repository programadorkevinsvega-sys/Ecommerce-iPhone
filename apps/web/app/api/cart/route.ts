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
import { logServerError } from "../../../server/serverLogger";

const GENERIC_ERROR = "No pudimos completar la operación.";
const VALIDATION_ERROR = "Revisa los datos ingresados e inténtalo nuevamente.";

function errorResponse(error: unknown): Response {
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "SyntaxError"
  ) {
    return NextResponse.json(
      { error: VALIDATION_ERROR },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  const code =
    error instanceof Error && "code" in error && typeof error.code === "string"
      ? error.code.toUpperCase()
      : error instanceof Error
        ? error.message.toUpperCase()
        : "UNKNOWN";
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

async function deterministicCartEventId(
  eventType: "CartItemAdded" | "CartItemRemoved",
  cartId: string,
  request: Request,
  productId: string,
  variantId?: string,
): Promise<string> {
  const operationKey =
    request.headers.get("Idempotency-Key")?.trim() ||
    request.headers.get("x-request-id")?.trim() ||
    crypto.randomUUID();
  const source = [eventType, cartId, productId, variantId ?? "", operationKey].join("\\u0000");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `cart-${eventType === "CartItemAdded" ? "added" : "removed"}:${fingerprint}`;
}

function publishCartAnalytics(
  eventType: "CartItemAdded" | "CartItemRemoved",
  cartId: string,
  request: Request,
  analytics: Readonly<{ sessionId: string; visitorId: string }>,
  payload: Readonly<Record<string, string | number | boolean | null>>,
  operation: string,
): Promise<void> {
  let eventId: string | undefined;
  const requestId = request.headers.get("x-request-id")?.trim() || undefined;
  return deterministicCartEventId(
    eventType,
    cartId,
    request,
    String(payload.productId),
    typeof payload.variantId === "string" ? payload.variantId : undefined,
  )
    .then((id) => {
      eventId = id;
      return analyticsApp(cloudflareEnv()).record({
        eventId: id,
        eventType,
        source: "server",
        occurredAt: new Date().toISOString(),
        sessionId: analytics.sessionId,
        visitorId: analytics.visitorId,
        requestId,
        payload,
      });
    })
    .catch((error: unknown) => {
      logServerError(operation, error, {
        component: "analytics",
        eventId,
        eventType,
        requestId,
        cartId,
        outcome: "failed",
      });
    });
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
    const mutation = await context.cart.addItemWithMutation({
      cartId: id,
      productId: body.productId,
      quantity: body.quantity,
      ...(body.variantId ? { variantId: body.variantId } : {}),
    });
    const analytics = ensureAnalyticsContext(request);
    if (mutation.changed) {
      cloudflareWaitUntil(
        publishCartAnalytics(
          "CartItemAdded",
          id,
          request,
          analytics,
          {
            cartId: id,
            productId: body.productId,
            quantity: body.quantity,
            ...(body.variantId ? { variantId: body.variantId } : {}),
          },
          "analytics.cart_item_added",
        ),
      );
    }
    const response = NextResponse.json(mutation.cart, { headers: { "cache-control": "no-store" } });
    if (!(await cookies()).get("cart_id")) setCartCookie(response, id);
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
    const mutation = await context.cart.removeItemWithMutation({
      cartId: id,
      productId: body.productId,
      ...(body.variantId ? { variantId: body.variantId } : {}),
    });
    const analytics = ensureAnalyticsContext(request);
    if (mutation.changed) {
      cloudflareWaitUntil(
        publishCartAnalytics(
          "CartItemRemoved",
          id,
          request,
          analytics,
          {
            cartId: id,
            productId: body.productId,
            ...(body.variantId ? { variantId: body.variantId } : {}),
          },
          "analytics.cart_item_removed",
        ),
      );
    }
    const response = NextResponse.json(mutation.cart, { headers: { "cache-control": "no-store" } });
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
