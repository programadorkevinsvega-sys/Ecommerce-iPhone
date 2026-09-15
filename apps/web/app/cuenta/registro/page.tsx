"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

export default function CustomerRegisterPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/customer/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
    });
    const body = await response.json();
    if (response.ok) window.location.href = "/cuenta";
    else setError(body.error ?? "No pudimos crear la cuenta.");
    setBusy(false);
  }

  return (
    <main className="store-shell auth-page">
      <section className="auth-card">
        <p className="eyebrow">Cuenta de cliente</p>
        <h1>Crea tu cuenta.</h1>
        <form onSubmit={submit}>
          <div className="form-two">
            <label>Nombre<input name="firstName" required autoComplete="given-name" /></label>
            <label>Apellido<input name="lastName" required autoComplete="family-name" /></label>
          </div>
          <label>Correo<input name="email" type="email" required autoComplete="email" /></label>
          <label>Teléfono<input name="phone" autoComplete="tel" /></label>
          <label>WhatsApp<input name="whatsapp" autoComplete="tel" /></label>
          <label>País<input name="countryCode" defaultValue="CO" maxLength={2} autoComplete="country" required /></label>
          <label>Contraseña<input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button primary" disabled={busy}>{busy ? "Creando…" : "Crear cuenta"}</button>
        </form>
        <p>¿Ya tienes cuenta? <Link href="/cuenta/login">Iniciar sesión</Link></p>
      </section>
    </main>
  );
}
