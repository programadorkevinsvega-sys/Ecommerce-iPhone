"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { normalizeEmail, safeFormError } from "../../../lib/inputValidation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    const normalizedEmail = normalizeEmail(email);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      if (!response.ok) {
        setError(safeFormError(response.status, "No se pudo iniciar sesión."));
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("No fue posible conectar con el servicio de autenticación. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <form onSubmit={submit} noValidate={false} aria-describedby={error ? "admin-login-error" : undefined} style={{ width: "100%", maxWidth: 420, display: "grid", gap: 16, padding: 28, border: "1px solid #ddd", borderRadius: 20 }}>
        <div><h1>Panel administrativo</h1><p>Acceso seguro para operadores autorizados.</p></div>
        <label htmlFor="admin-login-email">Email</label>
        <input
          id="admin-login-email"
          name="email"
          required
          type="email"
          inputMode="email"
          autoComplete="username"
          minLength={3}
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(error)}
        />
        <label htmlFor="admin-login-password">Contraseña</label>
        <input
          id="admin-login-password"
          name="password"
          required
          type="password"
          autoComplete="current-password"
          minLength={1}
          maxLength={1024}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(error)}
        />
        {error && <p id="admin-login-error" role="alert">{error}</p>}
        <button disabled={loading} type="submit">{loading ? "Entrando…" : "Iniciar sesión"}</button>
      </form>
    </main>
  );
}
