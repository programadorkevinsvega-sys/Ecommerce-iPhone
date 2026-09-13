"use client";

import Link from "next/link";
import { useState } from "react";
import type { PaymentProvider } from "../../../../modules/payments/domain/Payment";
import { assertLength, normalizeSingleLine, safeFormError, validateEmail, validatePhone } from "../../lib/inputValidation";
import { PAYMENT_PROVIDER_OPTIONS, validatePaymentRedirect } from "../../lib/paymentProviderConfig";

export default function CheckoutPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [paymentIdempotencyKey] = useState(() => crypto.randomUUID());

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const get = (name: string) => form.get(name);

    try {
      const firstName = assertLength(normalizeSingleLine(get("firstName")), "name");
      const lastName = assertLength(normalizeSingleLine(get("lastName")), "name");
      const email = validateEmail(get("email"));
      const phone = validatePhone(String(get("phone") ?? ""));
      const shippingMethod = normalizeSingleLine(get("shippingMethod"));
      if (shippingMethod !== "DELIVERY" && shippingMethod !== "PICKUP") throw new Error("INVALID_SHIPPING_METHOD");

      const recipientName = assertLength(normalizeSingleLine(get("recipientName")), "name");
      const addressLine1 = assertLength(normalizeSingleLine(get("addressLine1")), "addressLine");
      const addressLine2 = normalizeSingleLine(get("addressLine2"));
      const city = assertLength(normalizeSingleLine(get("city")), "city");
      const state = assertLength(normalizeSingleLine(get("state")), "state");
      const postalCode = normalizeSingleLine(get("postalCode"));
      if (postalCode) assertLength(postalCode, "postalCode");

      const selectedProvider = normalizeSingleLine(get("paymentProvider")).toUpperCase();
      const providerEntry = PAYMENT_PROVIDER_OPTIONS.find(([value]) => value === selectedProvider);
      if (!providerEntry) throw new Error("UNAUTHORIZED_PAYMENT_PROVIDER");
      const provider = providerEntry[0] as PaymentProvider;

      const shippingAddress = {
        recipientName,
        phone,
        addressLine1,
        ...(addressLine2 ? { addressLine2 } : {}),
        city,
        state,
        ...(postalCode ? { postalCode } : {}),
        countryCode: "CO",
      };

      const orderResponse = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ email, firstName, lastName, phone, shippingMethod, shippingAddress }),
      });
      if (!orderResponse.ok) throw Object.assign(new Error("CHECKOUT_FAILED"), { status: orderResponse.status });
      const orderData = await orderResponse.json() as { order?: { id?: unknown } };
      const orderId = typeof orderData.order?.id === "string" ? orderData.order.id : "";
      if (!orderId) throw new Error("CHECKOUT_RESPONSE_INVALID");

      const paymentResponse = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": paymentIdempotencyKey },
        body: JSON.stringify({ orderId, paymentProvider: provider }),
      });
      if (!paymentResponse.ok) throw Object.assign(new Error("PAYMENT_PREPARATION_FAILED"), { status: paymentResponse.status });
      const paymentData = await paymentResponse.json() as { checkout?: { provider?: unknown; checkoutUrl?: unknown } };
      const checkout = paymentData.checkout;
      if (checkout?.provider !== provider || typeof checkout.checkoutUrl !== "string") throw new Error("PAYMENT_RESPONSE_INVALID");

      const redirectUrl = validatePaymentRedirect(provider, checkout.checkoutUrl, window.location.origin);
      window.location.assign(redirectUrl.href);
    } catch (err) {
      const status = typeof err === "object" && err !== null && "status" in err && typeof err.status === "number" ? err.status : undefined;
      setError(status === undefined ? "No fue posible completar el checkout. Revisa los datos e inténtalo nuevamente." : safeFormError(status, "No fue posible completar el checkout."));
      setLoading(false);
    }
  }

  return (
    <main className="store-shell">
      <header className="store-header"><Link href="/" className="brand-mark">Ecommerce iPhone</Link><nav aria-label="Principal"><Link href="/cart">Carrito</Link><Link href="/catalog">Catálogo</Link></nav></header>
      <section className="catalog-hero"><p className="eyebrow">Checkout seguro</p><h1>Datos de entrega y pago.</h1><p>El pedido se crea con precio y stock validados en servidor. Puedes elegir cualquiera de los proveedores de pago habilitados.</p></section>
      <form className="checkout-form" onSubmit={submit} aria-describedby={error ? "checkout-error" : undefined}>
        <fieldset><legend>Contacto</legend>
          <label htmlFor="checkout-first-name">Nombre</label><input id="checkout-first-name" name="firstName" type="text" required minLength={1} maxLength={80} autoComplete="given-name" />
          <label htmlFor="checkout-last-name">Apellido</label><input id="checkout-last-name" name="lastName" type="text" required minLength={1} maxLength={80} autoComplete="family-name" />
          <label htmlFor="checkout-email">Email</label><input id="checkout-email" name="email" type="email" required minLength={3} maxLength={254} autoComplete="email" inputMode="email" />
          <label htmlFor="checkout-phone">Teléfono</label><input id="checkout-phone" name="phone" type="tel" required minLength={7} maxLength={25} autoComplete="tel" inputMode="tel" />
        </fieldset>
        <fieldset><legend>Entrega</legend>
          <label htmlFor="checkout-shipping-method">Método</label><select id="checkout-shipping-method" name="shippingMethod" defaultValue="DELIVERY" required><option value="DELIVERY">Envío a domicilio</option><option value="PICKUP">Recogida</option></select>
          <label htmlFor="checkout-recipient">Nombre del destinatario</label><input id="checkout-recipient" name="recipientName" type="text" required minLength={1} maxLength={80} autoComplete="shipping name" />
          <label htmlFor="checkout-address">Dirección</label><input id="checkout-address" name="addressLine1" type="text" required minLength={1} maxLength={180} autoComplete="shipping street-address" />
          <label htmlFor="checkout-address-2">Apartamento / complemento</label><input id="checkout-address-2" name="addressLine2" type="text" maxLength={180} autoComplete="shipping address-line2" />
          <label htmlFor="checkout-city">Ciudad</label><input id="checkout-city" name="city" type="text" required minLength={1} maxLength={80} autoComplete="shipping address-level2" />
          <label htmlFor="checkout-state">Departamento</label><input id="checkout-state" name="state" type="text" required minLength={1} maxLength={80} autoComplete="shipping address-level1" />
          <label htmlFor="checkout-postal">Código postal</label><input id="checkout-postal" name="postalCode" type="text" minLength={3} maxLength={20} autoComplete="shipping postal-code" inputMode="numeric" />
        </fieldset>
        <fieldset><legend>Método de pago</legend>
          <label htmlFor="checkout-provider">Proveedor</label><select id="checkout-provider" name="paymentProvider" defaultValue="WOMPI" required aria-label="Proveedor de pago">{PAYMENT_PROVIDER_OPTIONS.map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}</select>
        </fieldset>
        {error && <p id="checkout-error" role="alert" className="form-error">{error}</p>}
        <button className="button primary" disabled={loading} type="submit">{loading ? "Preparando pago seguro…" : "Continuar al pago"}</button>
      </form>
    </main>
  );
}
