"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type LoginResponse = { error?: string };

export default function TechnicianLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/technician/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "same-origin",
        cache: "no-store",
      });

      const payload = await response.text();
      let data: LoginResponse = {};
      try {
        data = JSON.parse(payload) as LoginResponse;
      } catch {
        data = {};
      }

      if (!response.ok) {
        setError(data.error ?? "No se pudo iniciar sesión.");
        return;
      }

      window.location.href = "/technician";
    } catch {
      setError("No se pudo contactar al servicio de autenticación. Inténtalo nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="technician-auth-shell">
      <section className="technician-auth-brand">
        <Link href="/" className="technician-brand technician-brand-light">
          <span className="technician-brand-mark" aria-hidden="true">E</span>
          <span>
            <strong>Ecommerce iPhone</strong>
            <small>Área técnica</small>
          </span>
        </Link>

        <div>
          <p className="eyebrow">Acceso operativo</p>
          <h1>Un espacio para reparar mejor.</h1>
          <p>
            Consulta únicamente las órdenes asignadas a tu identidad técnica y
            deja trazabilidad de cada intervención.
          </p>
        </div>

        <div className="technician-auth-points" aria-label="Capacidades del portal técnico">
          <span>01 · Órdenes asignadas</span>
          <span>02 · Diagnóstico y reparación</span>
          <span>03 · Evidencia y control de calidad</span>
        </div>
      </section>

      <section className="technician-auth-panel" aria-labelledby="technician-login-title">
        <div className="technician-auth-card">
          <p className="eyebrow">Área técnica</p>
          <h2 id="technician-login-title">Iniciar sesión</h2>
          <p>Usa las credenciales creadas por Administración.</p>

          <form onSubmit={submit} className="technician-form">
            <label>
              Correo
              <input
                type="email"
                required
                value={email}
                autoComplete="username"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
              />
            </label>

            <label>
              Contraseña
              <input
                type="password"
                required
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
            </label>

            {error && (
              <p className="technician-form-error" role="alert">
                {error}
              </p>
            )}

            <button className="button primary" disabled={busy}>
              {busy ? "Entrando…" : "Iniciar sesión"}
            </button>
          </form>

          <p className="technician-login-note">
            Las cuentas técnicas no se registran públicamente. Si no puedes
            acceder, contacta a Administración.
          </p>
        </div>
      </section>
    </main>
  );
}
