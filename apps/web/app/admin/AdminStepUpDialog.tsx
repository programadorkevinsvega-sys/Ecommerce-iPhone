"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";

type AdminStepUpDialogProps = Readonly<{
  open: boolean;
  scope: "payments:refund" | "payments:void" | "admins:manage" | "settings:write";
  title: string;
  description: string;
  onCancel: () => void;
  onVerified: () => void | Promise<void>;
}>;

export default function AdminStepUpDialog({
  open,
  scope,
  title,
  description,
  onCancel,
  onVerified,
}: AdminStepUpDialogProps) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  function cancel() {
    setPassword("");
    setError("");
    onCancel();
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!busy) cancel();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "input:not([disabled]), button:not([disabled])",
      ),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth/step-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ password, scope }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo confirmar tu identidad.");
        return;
      }
      setPassword("");
      await onVerified();
    } catch {
      setError("No se pudo conectar con el servicio de autenticación.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-step-up-backdrop">
      <section
        className="admin-step-up-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-step-up-title"
        aria-describedby="admin-step-up-description"
        onKeyDown={handleDialogKeyDown}
      >
        <form onSubmit={submit}>
          <p className="admin-kicker">Confirmación de seguridad</p>
          <h2 id="admin-step-up-title">{title}</h2>
          <p id="admin-step-up-description">{description}</p>
          <label htmlFor="admin-step-up-password">Contraseña actual</label>
          <input
            id="admin-step-up-password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button className="admin-button" type="button" disabled={busy} onClick={cancel}>
              Cancelar
            </button>
            <button className="admin-button primary" type="submit" disabled={busy || !password}>
              {busy ? "Verificando…" : "Confirmar identidad"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
