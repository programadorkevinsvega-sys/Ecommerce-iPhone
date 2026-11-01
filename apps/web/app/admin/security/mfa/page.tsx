"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AdminPageShell from "../../AdminPageShell";
import AdminPanel from "../../AdminPanel";
import AdminSectionHeading from "../../AdminSectionHeading";

type MfaStatus = Readonly<{ enabled: boolean; recoveryCodesRemaining: number }>;

export default function AdminMfaSecurityPage() {
  const router = useRouter();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadStatus() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth/mfa/status", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json() as MfaStatus & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo consultar el estado de MFA.");
      setStatus(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo consultar el estado de MFA.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadStatus(); }, []);

  async function runAction(action: "recovery" | "disable", event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const actionPassword = action === "recovery" ? recoveryPassword : disablePassword;
    const actionCode = action === "recovery" ? recoveryCode : disableCode;
    if (busy || !actionPassword || !actionCode) return;
    if (action === "disable" && !window.confirm("Desactivar MFA cerrará todas las sesiones y exigirá volver a inscribir un autenticador en el próximo acceso. ¿Continuar?")) return;
    setBusy(true);
    setError("");
    setMessage("");
    setRecoveryCodes([]);
    try {
      const response = await fetch(
        action === "recovery" ? "/api/admin/auth/mfa/recovery" : "/api/admin/auth/mfa/disable",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: actionPassword, code: actionCode }),
        },
      );
      const data = await response.json() as { error?: string; recoveryCodes?: string[]; disabled?: boolean };
      if (!response.ok) throw new Error(data.error ?? "No se pudo completar la operación.");
      if (action === "recovery") { setRecoveryPassword(""); setRecoveryCode(""); }
      else { setDisablePassword(""); setDisableCode(""); }
      if (action === "recovery") {
        setRecoveryCodes(data.recoveryCodes ?? []);
        setMessage("Los códigos anteriores se invalidaron. Guarda estos nuevos códigos; no volverán a mostrarse.");
        await loadStatus();
      } else {
        router.replace("/admin/login");
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo completar la operación.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      active="security"
      kicker="Cuenta administrativa"
      title="Autenticación multifactor"
      description="Administra tu segundo factor y tus códigos de recuperación. Cada operación sensible exige contraseña y MFA."
    >
      {error && <p className="admin-error" role="alert">{error}</p>}
      {message && <p className="admin-notice" role="status">{message}</p>}
      <section className="admin-workspace admin-page-grid">
        <AdminPanel>
          <AdminSectionHeading kicker="Estado" title="Protección de la cuenta" />
          {loading ? <p role="status">Consultando MFA…</p> : (
            <>
              <p>{status?.enabled ? "MFA está activo para esta cuenta." : "MFA no está activo. Cierra la sesión e inicia nuevamente para completar la inscripción."}</p>
              <p>Códigos de recuperación disponibles: <strong>{status?.recoveryCodesRemaining ?? 0}</strong></p>
              <p>Los secretos TOTP nunca se muestran en esta pantalla.</p>
            </>
          )}
        </AdminPanel>
        <AdminPanel>
          <AdminSectionHeading kicker="Recuperación" title="Regenerar códigos" />
          <p>La regeneración invalida inmediatamente todos los códigos anteriores y muestra los nuevos una sola vez.</p>
          <form className="admin-form" onSubmit={(event) => runAction("recovery", event)}>
            <label htmlFor="admin-mfa-recovery-password">Contraseña actual</label>
            <input id="admin-mfa-recovery-password" type="password" autoComplete="current-password" required maxLength={128} value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} />
            <label htmlFor="admin-mfa-recovery-code">Código TOTP o de recuperación</label>
            <input id="admin-mfa-recovery-code" type="text" autoComplete="one-time-code" required maxLength={40} value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} />
            <button className="admin-button primary" type="submit" disabled={busy || loading || !status?.enabled || !recoveryPassword || !recoveryCode}>Regenerar códigos de recuperación</button>
          </form>
          {recoveryCodes.length > 0 && (
            <section aria-labelledby="admin-mfa-new-codes">
              <h3 id="admin-mfa-new-codes">Nuevos códigos (solo esta vez)</h3>
              <ul>{recoveryCodes.map((value) => <li key={value}><code>{value}</code></li>)}</ul>
            </section>
          )}
        </AdminPanel>
        <AdminPanel>
          <AdminSectionHeading kicker="Control" title="Desactivar MFA" />
          <p>Desactivar MFA invalida códigos de recuperación, grants privilegiados y todas las sesiones actuales. En el próximo acceso se exigirá una nueva inscripción.</p>
          <form className="admin-form" onSubmit={(event) => runAction("disable", event)}>
            <label htmlFor="admin-mfa-disable-password">Contraseña actual</label>
            <input id="admin-mfa-disable-password" type="password" autoComplete="current-password" required maxLength={128} value={disablePassword} onChange={(event) => setDisablePassword(event.target.value)} />
            <label htmlFor="admin-mfa-disable-code">Código TOTP o de recuperación</label>
            <input id="admin-mfa-disable-code" type="text" autoComplete="one-time-code" required maxLength={40} value={disableCode} onChange={(event) => setDisableCode(event.target.value)} />
            <button className="admin-button danger" type="submit" disabled={busy || loading || !status?.enabled || !disablePassword || !disableCode}>Desactivar MFA y cerrar sesiones</button>
          </form>
        </AdminPanel>
      </section>
    </AdminPageShell>
  );
}
