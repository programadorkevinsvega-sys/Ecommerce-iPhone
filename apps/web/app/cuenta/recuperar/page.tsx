"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

type Mode = "request" | "reset" | "sent" | "done";

export default function RecoverPage() {
  const [mode, setMode] = useState<Mode>("request");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token")?.trim() ?? "";
    if (value) {
      setToken(value);
      setMode("reset");
    }
  }, []);

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/customer/auth/recover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      if (!response.ok) throw new Error("No pudimos procesar la solicitud.");
      setMode("sent");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos procesar la solicitud.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (String(values.password) !== String(values.confirmPassword)) {
      setError("Las contraseñas no coinciden.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/customer/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password: values.password }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "El enlace no es válido o ya expiró.");
      setMode("done");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="store-shell auth-page">
      <section className="auth-card">
        <p className="eyebrow">Recuperación segura</p>
        <h1>{mode === "reset" ? "Crea una nueva contraseña." : "Recupera tu acceso."}</h1>
        {mode === "request" && (
          <form onSubmit={requestRecovery}>
            <label>Correo<input name="email" type="email" required autoComplete="email" /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button primary" disabled={busy}>{busy ? "Enviando…" : "Enviar instrucciones"}</button>
          </form>
        )}
        {mode === "sent" && <p>Si la cuenta existe, recibirás instrucciones para continuar.</p>}
        {mode === "reset" && (
          <form onSubmit={resetPassword}>
            <label>Nueva contraseña<input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" /></label>
            <label>Repite la contraseña<input name="confirmPassword" type="password" minLength={12} maxLength={128} required autoComplete="new-password" /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button primary" disabled={busy}>{busy ? "Guardando…" : "Cambiar contraseña"}</button>
          </form>
        )}
        {mode === "done" && <p>Tu contraseña fue actualizada correctamente. Ya puedes iniciar sesión.</p>}
        <p><Link href="/cuenta/login">Volver a iniciar sesión</Link></p>
      </section>
    </main>
  );
}
