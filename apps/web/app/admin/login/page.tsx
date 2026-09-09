"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/admin/auth/login", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email,password}) });
    const data = await response.json() as { error?: string };
    setLoading(false);
    if (!response.ok) { setError(data.error ?? "No se pudo iniciar sesión"); return; }
    router.replace("/admin"); router.refresh();
  }
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24}}><form onSubmit={submit} style={{width:"100%",maxWidth:420,display:"grid",gap:16,padding:28,border:"1px solid #ddd",borderRadius:20}}><div><h1>Panel administrativo</h1><p>Acceso seguro para operadores autorizados.</p></div><label>Email<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Contraseña<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} /></label>{error&&<p role="alert">{error}</p>}<button disabled={loading} type="submit">{loading?"Entrando…":"Iniciar sesión"}</button></form></main>;
}
