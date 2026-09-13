"use client";
import Link from "next/link";
import { useState } from "react";
import type { PaymentProvider } from "../../../../modules/payments/domain/Payment";
import { PAYMENT_PROVIDER_OPTIONS, validatePaymentRedirect } from "../../lib/paymentProviderConfig";

export default function CheckoutPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [paymentIdempotencyKey] = useState(() => crypto.randomUUID());

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError("");
    const f = new FormData(e.currentTarget);
    const selectedProvider = String(f.get("paymentProvider")).trim().toUpperCase();
    const body = { email: String(f.get("email")), firstName: String(f.get("firstName")), lastName: String(f.get("lastName")), phone: String(f.get("phone")), shippingMethod: String(f.get("shippingMethod")), shippingAddress: { recipientName: String(f.get("recipientName")), phone: String(f.get("phone")), addressLine1: String(f.get("addressLine1")), addressLine2: String(f.get("addressLine2") || ""), city: String(f.get("city")), state: String(f.get("state")), postalCode: String(f.get("postalCode") || ""), countryCode: "CO" } };
    try {
      if (!(selectedProvider in Object.fromEntries(PAYMENT_PROVIDER_OPTIONS))) throw new Error("Proveedor de pago no autorizado");
      const provider = selectedProvider as PaymentProvider;
      const orderResponse = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(body) });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(orderData.error ?? "No se pudo crear el pedido");
      const paymentResponse = await fetch("/api/payments/intent", { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": paymentIdempotencyKey }, body: JSON.stringify({ orderId: orderData.order.id, paymentProvider: provider }) });
      const paymentData = await paymentResponse.json();
      if (!paymentResponse.ok) throw new Error(paymentData.error ?? "No se pudo preparar el pago");
      const checkout = paymentData?.checkout as { provider?: unknown; checkoutUrl?: unknown } | undefined;
      if (checkout?.provider !== provider || typeof checkout.checkoutUrl !== "string") throw new Error("Respuesta de pago inválida");
      const redirectUrl = validatePaymentRedirect(provider, checkout.checkoutUrl, window.location.origin);
      window.location.assign(redirectUrl.href);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo completar el checkout"); setLoading(false); }
  }

  return <main className="store-shell"><header className="store-header"><Link href="/" className="brand-mark">Ecommerce iPhone</Link><nav><Link href="/cart">Carrito</Link><Link href="/catalog">Catálogo</Link></nav></header><section className="catalog-hero"><p className="eyebrow">Checkout seguro</p><h1>Datos de entrega y pago.</h1><p>El pedido se crea con precio y stock validados en servidor. Puedes elegir cualquiera de los proveedores de pago habilitados.</p></section><form className="checkout-form" onSubmit={submit}><fieldset><legend>Contacto</legend><label>Nombre<input name="firstName" required /></label><label>Apellido<input name="lastName" required /></label><label>Email<input name="email" type="email" required /></label><label>Teléfono<input name="phone" required /></label></fieldset><fieldset><legend>Entrega</legend><label>Método<select name="shippingMethod" defaultValue="DELIVERY"><option value="DELIVERY">Envío a domicilio</option><option value="PICKUP">Recogida</option></select></label><label>Nombre del destinatario<input name="recipientName" required /></label><label>Dirección<input name="addressLine1" required /></label><label>Apartamento / complemento<input name="addressLine2" /></label><label>Ciudad<input name="city" required /></label><label>Departamento<input name="state" required /></label><label>Código postal<input name="postalCode" /></label></fieldset><fieldset><legend>Método de pago</legend><label>Proveedor<select name="paymentProvider" defaultValue="WOMPI" required>{PAYMENT_PROVIDER_OPTIONS.map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}</select></label></fieldset>{error&&<p role="alert" className="form-error">{error}</p>}<button className="button primary" disabled={loading}>{loading?"Preparando pago seguro…":"Continuar al pago"}</button></form></main>;
}
