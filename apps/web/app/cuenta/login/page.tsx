"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/cuenta";
  return value;
}

export default function CustomerLoginPage() {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/customer/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
    });
    const body = await response.json();
    if (response.ok) {
      const next = safeReturnPath(new URLSearchParams(window.location.search).get("next"));
      window.location.href = next;
    } else {
      setError(body.error ?? "No pudimos iniciar sesión.");
    }
    setBusy(false);
  }

  return (
    <main className="store-shell auth-page">
      <section className="auth-card">
        <p className="eyebrow">Cuenta de cliente</p>
        <h1>Inicia sesión.</h1>
        <form onSubmit={submit}>
          <label>Correo<input name="email" type="email" required autoComplete="email" /></label>
          <label>Contraseña<input name="password" type="password" required autoComplete="current-password" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button primary" disabled={busy}>{busy ? "Entrando…" : "Iniciar sesión"}</button>
        </form>
        <p><Link href="/cuenta/recuperar">¿Olvidaste tu contraseña?</Link></p>
        <p>¿Aún no tienes cuenta? <Link href="/cuenta/registro">Crear cuenta</Link></p>
      </section>
    </main>
  );
}
