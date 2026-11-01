"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { normalizeEmail, safeFormError } from "../../../lib/inputValidation";

type MfaChallenge = Readonly<{
  purpose: "login" | "enroll";
  secret?: string;
  otpauthUri?: string;
}>;

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [stage, setStage] = useState<"password" | "mfa" | "recovery">("password");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(email), password }),
      });
      const data = await response.json() as { error?: string; mfaRequired?: boolean };
      if (!response.ok || response.status !== 202 || !data.mfaRequired) {
        setError(safeFormError(response.status, data.error ?? "No se pudo iniciar sesión."));
        return;
      }

      const challengeResponse = await fetch("/api/admin/auth/mfa/challenge", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const challengeData = await challengeResponse.json() as MfaChallenge & { error?: string };
      if (!challengeResponse.ok) {
        setError(challengeData.error ?? "No se pudo iniciar el segundo factor.");
        return;
      }
      setChallenge(challengeData);
      setPassword("");
      setCode("");
      setStage("mfa");
    } catch {
      setError("No fue posible conectar con el servicio de autenticación. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  async function verifySecondFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth/mfa/verify", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await response.json() as { error?: string; recoveryCodes?: string[] };
      if (!response.ok) {
        setError(data.error ?? "No se pudo verificar el segundo factor.");
        return;
      }
      setCode("");
      if (Array.isArray(data.recoveryCodes) && data.recoveryCodes.length > 0) {
        setRecoveryCodes(data.recoveryCodes);
        setStage("recovery");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("No fue posible conectar con el servicio de autenticación.");
    } finally {
      setLoading(false);
    }
  }

  function continueAfterRecovery() {
    setRecoveryCodes([]);
    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="admin-login-shell">
      {stage === "password" && (
        <form
          className="admin-login-form"
          onSubmit={submitPassword}
          aria-describedby={error ? "admin-login-error" : undefined}
        >
          <div>
            <h1>Panel administrativo</h1>
            <p>Acceso seguro para operadores autorizados.</p>
          </div>
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
            onChange={(event) => setEmail(event.target.value)}
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
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(error)}
          />
          {error && <p id="admin-login-error" role="alert">{error}</p>}
          <button disabled={loading} type="submit">
            {loading ? "Verificando…" : "Iniciar sesión"}
          </button>
        </form>
      )}

      {stage === "mfa" && challenge && (
        <form className="admin-login-form" onSubmit={verifySecondFactor} aria-describedby={error ? "admin-mfa-error" : "admin-mfa-help"}>
          <div>
            <h1>{challenge.purpose === "enroll" ? "Activa la autenticación MFA" : "Verifica tu identidad"}</h1>
            <p id="admin-mfa-help">
              {challenge.purpose === "enroll"
                ? "Añade esta clave en tu aplicación autenticadora como una cuenta TOTP y confirma el primer código. La sesión solo se abrirá después de verificarlo."
                : "Introduce el código de tu aplicación autenticadora. También puedes usar un código de recuperación no utilizado."}
            </p>
          </div>
          {challenge.purpose === "enroll" && challenge.otpauthUri && (
            <p>
              URI de configuración manual: <code className="admin-mfa-uri">{challenge.otpauthUri}</code>
            </p>
          )}
          {challenge.purpose === "enroll" && challenge.secret && (
            <p>
              Clave manual: <code>{challenge.secret}</code>
            </p>
          )}
          <label htmlFor="admin-login-mfa-code">
            {challenge.purpose === "enroll" ? "Código de seis dígitos" : "Código MFA o de recuperación"}
          </label>
          <input
            id="admin-login-mfa-code"
            name="mfa-code"
            required
            type="text"
            inputMode={challenge.purpose === "enroll" ? "numeric" : "text"}
            autoComplete="one-time-code"
            maxLength={challenge.purpose === "enroll" ? 6 : 40}
            pattern={challenge.purpose === "enroll" ? "[0-9]{6}" : undefined}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoFocus
          />
          {error && <p id="admin-mfa-error" role="alert">{error}</p>}
          <button disabled={loading || !code.trim()} type="submit">
            {loading ? "Verificando…" : "Verificar y continuar"}
          </button>
          <button type="button" disabled={loading} onClick={() => { setStage("password"); setChallenge(null); setCode(""); setError(""); }}>
            Volver al inicio de sesión
          </button>
        </form>
      )}

      {stage === "recovery" && (
        <section className="admin-login-form" aria-labelledby="admin-recovery-title">
          <h1 id="admin-recovery-title">Guarda tus códigos de recuperación</h1>
          <p role="alert">
            Estos códigos se muestran una sola vez. Guárdalos fuera del dispositivo y no los compartas.
            Cada código se invalida automáticamente después de utilizarlo.
          </p>
          <ul>
            {recoveryCodes.map((recoveryCode) => <li key={recoveryCode}><code>{recoveryCode}</code></li>)}
          </ul>
          <button type="button" onClick={continueAfterRecovery}>He guardado los códigos</button>
        </section>
      )}
    </main>
  );
}
