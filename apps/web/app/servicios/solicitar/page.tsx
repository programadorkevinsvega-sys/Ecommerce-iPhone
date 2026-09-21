"use client";
import StoreHeader from "../../components/StoreHeader";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  assertLength,
  normalizeMultiline,
  normalizeSingleLine,
  safeFormError,
  validateEmail,
} from "../../../lib/inputValidation";

type ServiceType = {
  code: string;
  name: string;
  description: string;
  workflow: {
    customerOwnershipProofRequired: boolean;
    quoteRequired: boolean;
    paymentRequired: boolean;
  };
};

export default function RequestServicePage() {
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [message, setMessage] = useState("");
  const [createdRequestId, setCreatedRequestId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/services", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("SERVICES_LOAD_FAILED");
        return response.json() as Promise<{ services?: ServiceType[] }>;
      })
      .then((data) => {
        const available = Array.isArray(data.services) ? data.services : [];
        setTypes(available);
        const requestedType = new URLSearchParams(window.location.search)
          .get("type")
          ?.trim()
          .toUpperCase();
        setType(
          available.find((service) => service.code === requestedType)?.code ??
            available[0]?.code ??
            "",
        );
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage("No fue posible cargar los servicios disponibles.");
      })
      .finally(() => setLoadingTypes(false));
    return () => controller.abort();
  }, []);

  const selected = types.find((x) => x.code === type);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");
    const form = new FormData(e.currentTarget);
    try {
      const selectedType = types.find((x) => x.code === normalizeSingleLine(type));
      if (!selectedType) throw new Error("INVALID_SERVICE_TYPE");
      const email = validateEmail(form.get("email"));
      const phone = normalizeSingleLine(form.get("phone"));
      const whatsapp = normalizeSingleLine(form.get("whatsapp"));
      if (!/^[+()\d][\d\s().-]{6,24}$/u.test(phone)) throw new Error("INVALID_PHONE");
      if (!/^[+()\d][\d\s().-]{6,24}$/u.test(whatsapp)) throw new Error("INVALID_PHONE");
      const countryCode = normalizeSingleLine(form.get("countryCode")).toUpperCase();
      if (!/^[A-Z]{2}$/u.test(countryCode)) throw new Error("INVALID_COUNTRY");
      const deviceBrand = assertLength(normalizeSingleLine(form.get("deviceBrand")), "deviceBrand");
      const deviceModel = assertLength(normalizeSingleLine(form.get("deviceModel")), "deviceModel");
      const carrier = normalizeSingleLine(form.get("carrier"));
      if (selectedType.code === "CARRIER_UNLOCK") assertLength(carrier, "carrier");
      const imei = normalizeSingleLine(form.get("imei")).replace(/\D/gu, "");
      if (imei && (imei.length < 4 || imei.length > 20)) throw new Error("INVALID_IMEI");
      const serial = normalizeSingleLine(form.get("serial"));
      if (serial) assertLength(serial, "serial");
      const problemDescription = assertLength(
        normalizeMultiline(form.get("problemDescription")),
        "serviceDescription",
      );
      const customerNotes = normalizeMultiline(form.get("customerNotes"));
      if (customerNotes.length > 2000) throw new Error("INVALID_SERVICE_NOTES");

      const response = await fetch("/api/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          phone,
          whatsapp,
          countryCode,
          type: selectedType.code,
          deviceBrand,
          deviceModel,
          ...(imei ? { imei } : {}),
          ...(serial ? { serial } : {}),
          ...(carrier ? { carrier } : {}),
          problemDescription,
          ...(customerNotes ? { customerNotes } : {}),
        }),
      });
      if (!response.ok) {
        setMessage(
          safeFormError(response.status, "No fue posible crear la solicitud de servicio."),
        );
        return;
      }
      const data = (await response.json()) as { request?: { id?: unknown } };
      const requestId = typeof data.request?.id === "string" ? data.request.id : "";
      if (!requestId) throw new Error("INVALID_SERVICE_RESPONSE");
      setCreatedRequestId(requestId);
      e.currentTarget.reset();
    } catch (error) {
      setMessage(
        error instanceof Error && error.message.startsWith("INVALID_")
          ? "Revisa los datos del formulario e inténtalo nuevamente."
          : "No fue posible crear la solicitud de servicio.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="store-shell">
      <StoreHeader activeHref="/servicios" />
      <section className="catalog-hero">
        <p className="eyebrow">Solicitud técnica</p>
        <h1>Cuéntanos qué necesita tu dispositivo.</h1>
        <p>Los servicios y sus requisitos se configuran desde el catálogo operativo.</p>
      </section>
      {createdRequestId ? <section className="service-success" aria-live="polite"><p className="eyebrow">Solicitud recibida</p><h2>Ya tenemos tu solicitud.</h2><p>Conserva este identificador para consultar el avance con nuestro equipo:</p><strong>{createdRequestId}</strong><div className="hero-actions"><Link className="button primary" href="/servicios">Volver a servicios</Link><button className="button secondary" type="button" onClick={() => setCreatedRequestId("")}>Crear otra solicitud</button></div></section> : <form
        className="checkout-card"
        onSubmit={submit}
        aria-describedby={message ? "service-form-message" : undefined}
      >
        {loadingTypes ? (
          <p>Cargando servicios…</p>
        ) : (
          <>
            <label htmlFor="service-type">Servicio</label>
            <select
              id="service-type"
              required
              value={type}
              onChange={(e) => setType(normalizeSingleLine(e.target.value))}
              autoComplete="off"
            >
              {types.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.name}
                </option>
              ))}
            </select>
            {selected && (
              <p>
                {selected.description}
                {selected.workflow.quoteRequired ? " Se requiere cotización." : ""}
                {selected.workflow.paymentRequired ? " Requiere pago según la configuración." : ""}
              </p>
            )}
            <label htmlFor="service-email">Correo</label>
            <input
              id="service-email"
              required
              name="email"
              type="email"
              minLength={3}
              maxLength={254}
              autoComplete="email"
              inputMode="email"
              placeholder="tu@email.com"
            />
            <div className="form-grid">
              <div><label htmlFor="service-phone">Teléfono de llamada</label><input id="service-phone" required name="phone" type="tel" maxLength={25} autoComplete="tel" placeholder="+57 300 000 0000" /></div>
              <div><label htmlFor="service-whatsapp">WhatsApp</label><input id="service-whatsapp" required name="whatsapp" type="tel" maxLength={25} autoComplete="tel" placeholder="+57 300 000 0000" /></div>
            </div>
            <label htmlFor="service-country">País</label>
            <select id="service-country" required name="countryCode" defaultValue="CO" autoComplete="country">
              <option value="CO">Colombia</option><option value="MX">México</option><option value="PA">Panamá</option><option value="EC">Ecuador</option><option value="PE">Perú</option><option value="US">Estados Unidos</option><option value="ES">España</option>
            </select>
            <div className="form-grid">
              <div>
                <label htmlFor="service-brand">Marca</label>
                <input
                  id="service-brand"
                  required
                  name="deviceBrand"
                  type="text"
                  minLength={1}
                  maxLength={80}
                  autoComplete="off"
                  placeholder="Apple"
                />
              </div>
              <div>
                <label htmlFor="service-model">Modelo</label>
                <input
                  id="service-model"
                  required
                  name="deviceModel"
                  type="text"
                  minLength={1}
                  maxLength={120}
                  autoComplete="off"
                  placeholder="iPhone 17 Pro"
                />
              </div>
            </div>
            {type === "CARRIER_UNLOCK" && (
              <label htmlFor="service-carrier">
                Operador actual
                <input
                  id="service-carrier"
                  required
                  name="carrier"
                  type="text"
                  minLength={1}
                  maxLength={100}
                  autoComplete="organization"
                  placeholder="Operador"
                />
              </label>
            )}
            <div className="form-grid">
              <div>
                <label htmlFor="service-imei">IMEI (opcional)</label>
                <input
                  id="service-imei"
                  name="imei"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={20}
                  autoComplete="off"
                  placeholder="Solo se almacenan los últimos 4"
                />
              </div>
              <div>
                <label htmlFor="service-serial">Serial (opcional)</label>
                <input
                  id="service-serial"
                  name="serial"
                  type="text"
                  maxLength={30}
                  autoComplete="off"
                  placeholder="Solo se almacenan los últimos 4"
                />
              </div>
            </div>
            <label htmlFor="service-problem">Describe el problema o servicio requerido</label>
            <textarea
              id="service-problem"
              required
              name="problemDescription"
              minLength={1}
              maxLength={3000}
              rows={5}
              autoComplete="off"
              placeholder="Qué sucede, desde cuándo y qué necesitas..."
            />
            <label htmlFor="service-notes">Notas adicionales</label>
            <textarea
              id="service-notes"
              name="customerNotes"
              maxLength={2000}
              rows={3}
              autoComplete="off"
            />
            {message && (
              <p id="service-form-message" role="alert">
                {message}
              </p>
            )}
            <button className="primary-button" type="submit" disabled={loading || !type}>
              {loading ? "Enviando…" : "Crear solicitud"}
            </button>
          </>
        )}
      </form>}
    </main>
  );
}
