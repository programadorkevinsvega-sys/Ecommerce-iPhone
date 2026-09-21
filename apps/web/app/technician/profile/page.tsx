"use client";
import { useEffect, useState } from "react";
import TechnicianHeader from "../TechnicianHeader";

type Profile = { email: string; firstName: string; lastName: string; phone: string | null };

export default function TechnicianProfile() {
  const [profile, setProfile] = useState<Profile | null>(null); const [firstName, setFirst] = useState(""); const [lastName, setLast] = useState(""); const [phone, setPhone] = useState(""); const [message, setMessage] = useState("");
  useEffect(() => {
    void (async () => { const response = await fetch("/api/technician/profile", { cache: "no-store" }); if (response.status === 401) { window.location.href = "/technician/login"; return; } if (response.ok) { const data = await response.json() as { technician: Profile }; setProfile(data.technician); setFirst(data.technician.firstName); setLast(data.technician.lastName); setPhone(data.technician.phone ?? ""); } })();
  }, []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/technician/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName, lastName, phone }), cache: "no-store" });
    setMessage(response.ok ? "Perfil actualizado." : "No se pudo actualizar.");
    if (response.ok && profile) setProfile({ ...profile, firstName, lastName, phone: phone || null });
  }
  return <main className="technician-shell">
    <TechnicianHeader firstName={profile?.firstName} email={profile?.email} />
    <section className="technician-page-head"><div><p className="eyebrow">Cuenta técnica</p><h1>Mi perfil.</h1><p>Actualiza tus datos personales. Las credenciales de acceso son administradas por Administración.</p></div></section>
    <section className="technician-profile-grid">
      <article className="technician-card technician-profile-identity"><span className="technician-avatar large">{(profile?.firstName?.[0] ?? "T") + (profile?.lastName?.[0] ?? "")}</span><p className="eyebrow">Identidad</p><h2>{profile ? profile.firstName + " " + profile.lastName : "Técnico"}</h2><p>{profile?.email ?? "Cargando cuenta técnica…"}</p><span className="technician-role-badge">TÉCNICO</span><small>Cuenta operativa independiente del backoffice.</small></article>
      <article className="technician-card"><div className="technician-section-head"><div><p className="eyebrow">Datos personales</p><h2>Información del perfil</h2></div></div><form onSubmit={save} className="technician-form"><label>Correo<input readOnly value={profile?.email ?? ""} /></label><div className="technician-form-grid"><label>Nombre<input required value={firstName} onChange={(event) => setFirst(event.target.value)} /></label><label>Apellido<input required value={lastName} onChange={(event) => setLast(event.target.value)} /></label></div><label>Teléfono<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>{message && <p className="technician-form-note" role="status">{message}</p>}<button className="button primary">Guardar cambios</button></form></article>
    </section>
  </main>;
}