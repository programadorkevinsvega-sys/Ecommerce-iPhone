"use client";
import {useEffect,useState,type FormEvent} from "react";
import AdminPageShell from "../AdminPageShell";
import AdminPanel from "../AdminPanel";
import AdminSectionHeading from "../AdminSectionHeading";
import AdminTable from "../AdminTable";
import AdminEmptyState from "../AdminEmptyState";
import AdminLoadingState from "../AdminLoadingState";
type Campaign={id:string;name:string;slug:string;description?:string;startsAt:string;endsAt:string;active:boolean};
const empty={name:"",slug:"",description:"",startsAt:"",endsAt:"",active:true};
export default function CampaignsPage(){const[items,setItems]=useState<Campaign[]>([]),[form,setForm]=useState(empty),[id,setId]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("");
async function load(){setLoading(true);try{const r=await fetch("/api/admin/campaigns",{cache:"no-store"});const d=await r.json() as{items?:Campaign[];error?:string};if(!r.ok)throw new Error(d.error);setItems(d.items??[]);}catch(e){setError(e instanceof Error?e.message:"No se pudieron cargar las campañas.");}finally{setLoading(false);}}useEffect(()=>{void load();},[]);
async function toggle(x: Campaign) {
  const active = !x.active;
  if (!window.confirm(active ? "¿Activar esta campaña?" : "¿Desactivar esta campaña?")) return;
  setError("");
  const r = await fetch("/api/admin/campaigns", { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id: x.id, active }) });
  const d = await r.json() as { error?: string };
  if (!r.ok) { setError(d.error ?? "No se pudo actualizar la campaña."); return; }
  await load();
}
function edit(x?:Campaign){if(!x){setId("");setForm(empty);return;}setId(x.id);setForm({name:x.name,slug:x.slug,description:x.description??"",startsAt:new Date(x.startsAt).toISOString().slice(0,16),endsAt:new Date(x.endsAt).toISOString().slice(0,16),active:x.active});}
async function save(e:FormEvent){e.preventDefault();setSaving(true);try{const r=await fetch("/api/admin/campaigns",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...(id?{id}:{}),...form,startsAt:new Date(form.startsAt).toISOString(),endsAt:new Date(form.endsAt).toISOString()})});const d=await r.json() as{error?:string};if(!r.ok)throw new Error(d.error);edit();await load();}catch(e){setError(e instanceof Error?e.message:"No se pudo guardar la campaña.");}finally{setSaving(false);}}
return <AdminPageShell active="promotions" kicker="Marketing" title="Campañas" description="Gestiona ventanas de campañas comerciales reales.">{error&&<p className="admin-error" role="alert">{error}</p>}<section className="admin-workspace admin-page-grid"><AdminPanel><AdminSectionHeading kicker="Campaña" title={id?"Editar campaña":"Nueva campaña"} actions={id?<button className="admin-button" onClick={()=>edit()} type="button">Nueva</button>:undefined}/><form className="admin-form" onSubmit={save}><label>Nombre<input required maxLength={200} value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/></label><label>Slug<input required maxLength={120} value={form.slug} onChange={e=>setForm(v=>({...v,slug:e.target.value}))}/></label><label>Descripción<textarea rows={4} maxLength={2000} value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/></label><label>Inicio<input type="datetime-local" required value={form.startsAt} onChange={e=>setForm(v=>({...v,startsAt:e.target.value}))}/></label><label>Fin<input type="datetime-local" required value={form.endsAt} onChange={e=>setForm(v=>({...v,endsAt:e.target.value}))}/></label><label className="checkbox-label"><input type="checkbox" checked={form.active} onChange={e=>setForm(v=>({...v,active:e.target.checked}))}/> Activa</label><button className="admin-button primary" disabled={saving}>{saving?"Guardando…":"Guardar campaña"}</button></form></AdminPanel><AdminPanel><AdminSectionHeading kicker="Marketing" title="Campañas registradas"/>{loading?<AdminLoadingState label="Cargando campañas…"/>:<AdminTable headers={["Nombre","Slug","Vigencia","Estado","Acciones"]} empty={!items.length?<AdminEmptyState title="No hay campañas"/>:undefined}>{items.map(x=><tr key={x.id}><td>{x.name}</td><td>{x.slug}</td><td>{new Date(x.startsAt).toLocaleDateString("es-CO")} — {new Date(x.endsAt).toLocaleDateString("es-CO")}</td><td>{x.active?"Activa":"Inactiva"}</td><td><button className="table-action" onClick={()=>edit(x)}>Editar</button><button className="table-action" onClick={()=>void toggle(x)}>{x.active?"Desactivar":"Activar"}</button></td></tr>)}</AdminTable>}</AdminPanel></section></AdminPageShell>;}
