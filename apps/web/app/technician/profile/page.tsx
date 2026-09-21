"use client";

import { useEffect, useState } from "react";
import TechnicianHeader from "../TechnicianHeader";

type Profile = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
};

export default function TechnicianProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/technician/profile", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/technician/login";
        return;
      }
      const data = await response.json() as { technician?: Profile; error?: string };
      if (!response.ok || !data.technician) {
        setError(data.error ?? "No se pudo cargar el perfil.");
        return;
      }
      setProfile(data.technician);
      setFirst(data.technician.firstName);
      setLast(data.technician.lastName);
      setPhone(data.technician.phone ?? "");
    } catch {
      setError("No se pudo contactar al servicio de perfil.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || saving) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/technician/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({})) as { technician?: Profile; error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo actualizar el perfil.");
        return;
      }

      const updated = data.technician ?? {
        ...profile,
        firstName,
        lastName,
        phone: phone || null,
      };
      setProfile(updated);
      setFirst(updated.firstName);
      setLast(updated.lastName);
      setPhone(updated.phone ?? "");
      setMessage("Perfil actualizado correctamente.");
    } catch {
      setError("No se pudo guardar el perfil. Inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="technician-shell">
      <TechnicianHeader firstName={profile?.firstName} email={profile?.email} />

      <section className="technician-page-head">
        <div>
          <p className="eyebrow">Cuenta técnica</p>
          <h1>Mi perfil.</h1>
          <p>Actualiza tus datos personales. Las credenciales de acceso son administradas por Administración.</p>
        </div>
      </section>

      {error && (
        <div className="technician-alert" role="alert">
          <strong>No se pudo completar la operación.</strong>
          <span>{error}</span>
          <button type="button" className="button secondary" onClick={() => void load()} disabled={loading || saving}>
            Reintentar
          </button>
        </div>
      )}

      <section className="technician-profile-grid">
        <article className="technician-card technician-profile-identity">
          <span className="technician-avatar large" aria-hidden="true">
            {(profile?.firstName?.[0] ?? "T") + (profile?.lastName?.[0] ?? "")}
          </span>
          <p className="eyebrow">Identidad</p>
          <h2>{profile ? profile.firstName + " " + profile.lastName : "Técnico"}</h2>
          <p>{profile?.email ?? (loading ? "Cargando cuenta técnica…" : "Cuenta técnica")}</p>
          <span className="technician-role-badge">TÉCNICO</span>
          <small>Cuenta operativa independiente del backoffice.</small>
        </article>

        <article className="technician-card">
          <div className="technician-section-head">
            <div>
              <p className="eyebrow">Datos personales</p>
              <h2>Información del perfil</h2>
            </div>
          </div>

          {loading ? (
            <div className="technician-empty" role="status" aria-live="polite">
              <strong>Cargando perfil.</strong>
              <span>Consultando tu identidad técnica actual.</span>
            </div>
          ) : (
            <form onSubmit={(event) => void save(event)} className="technician-form">
              <label>Correo<input readOnly value={profile?.email ?? ""} /></label>
              <div className="technician-form-grid">
                <label>Nombre<input required value={firstName} disabled={saving} onChange={(event) => setFirst(event.target.value)} /></label>
                <label>Apellido<input required value={lastName} disabled={saving} onChange={(event) => setLast(event.target.value)} /></label>
              </div>
              <label>Teléfono<input value={phone} disabled={saving} onChange={(event) => setPhone(event.target.value)} /></label>
              {message && <p className="technician-form-note" role="status" aria-live="polite">{message}</p>}
              {error && <p className="technician-form-error" role="alert">{error}</p>}
              <button className="button primary" disabled={saving || !profile}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </form>
          )}
        </article>
      </section>
    </main>
  );
}
