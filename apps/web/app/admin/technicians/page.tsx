"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import AdminPageShell from "../AdminPageShell";
import AdminPanel from "../AdminPanel";
import AdminSectionHeading from "../AdminSectionHeading";
import AdminTable from "../AdminTable";
import AdminEmptyState from "../AdminEmptyState";
import AdminLoadingState from "../AdminLoadingState";

type Technician = { id:string; email:string; firstName:string; lastName:string; phone:string|null; active:boolean; lastLoginAt:string|null };
type FormState = { email:string; firstName:string; lastName:string; phone:string; password:string };
const EMPTY:FormState={email:"",firstName:"",lastName:"",phone:"",password:""};

export default function AdminTechniciansPage(){
 const [items,setItems]=useState<Technician[]>([]),[form,setForm]=useState(EMPTY),[editing,setEditing]=useState<string|null>(null),[message,setMessage]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const load=useCallback(async()=>{setLoading(true);try{const r=await fetch("/api/admin/technicians",{cache:"no-store",credentials:"same-origin"});if(r.status===401||r.status===403){window.location.href="/admin/login";return;}const b=await r.json() as {items?:Technician[];error?:string};if(!r.ok){setMessage(b.error??"No se pudieron cargar los técnicos.");return;}setItems(b.items??[]);}catch{setMessage("No se pudieron cargar los técnicos.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 function reset(){setEditing(null);setForm(EMPTY);}
 async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();setSaving(true);setMessage("");try{const r=await fetch("/api/admin/technicians",{method:editing?"PATCH":"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...form,...(editing?{id:editing}:{})}),credentials:"same-origin",cache:"no-store"});const b=await r.json() as {error?:string};if(!r.ok){setMessage(b.error??"No se pudo guardar el técnico.");return;}setMessage(editing?"Técnico actualizado correctamente.":"Técnico creado correctamente.");reset();await load();}catch{setMessage("No se pudo completar la operación.");}finally{setSaving(false);}}
 async function toggle(item:Technician){const r=await fetch("/api/admin/technicians",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:item.id,active:!item.active}),credentials:"same-origin",cache:"no-store"});const b=await r.json() as {error?:string};setMessage(r.ok?"Estado actualizado.":b.error??"No se pudo actualizar.");if(r.ok)await load();}
 function edit(item:Technician){setEditing(item.id);setForm({email:item.email,firstName:item.firstName,lastName:item.lastName,phone:item.phone??"",password:""});setMessage("");}
 return <AdminPageShell active="technicians" kicker="Personal técnico" title="Técnicos" description="Gestiona las cuentas técnicas independientes que pueden recibir y operar órdenes asignadas.">
   {message&&<p className="admin-notice" role="status">{message}</p>}
   <section className="admin-workspace admin-page-grid">
     <AdminPanel>
       <AdminSectionHeading kicker="Credenciales" title={editing?"Editar técnico":"Crear técnico"} actions={editing?<button className="admin-button" type="button" onClick={reset}>Nuevo</button>:undefined}/>
       <p className="admin-section-description">Solo Administración crea estas cuentas. No existe registro público de técnicos.</p>
       <form className="admin-form" onSubmit={save}>
         <div className="form-grid">
           <label>Correo<input required type="email" value={form.email} onChange={(e)=>setForm(v=>({...v,email:e.target.value}))}/></label>
           <label>Nombre<input required value={form.firstName} onChange={(e)=>setForm(v=>({...v,firstName:e.target.value}))}/></label>
           <label>Apellido<input required value={form.lastName} onChange={(e)=>setForm(v=>({...v,lastName:e.target.value}))}/></label>
           <label>Teléfono<input value={form.phone} onChange={(e)=>setForm(v=>({...v,phone:e.target.value}))}/></label>
           <label>{editing?"Nueva contraseña (opcional)":"Contraseña inicial"}<input type="password" required={!editing} minLength={12} autoComplete="new-password" value={form.password} onChange={(e)=>setForm(v=>({...v,password:e.target.value}))}/></label>
         </div>
         <section className="technician-role-panel"><div><p className="admin-kicker">Autorización</p><h3>Rol operativo: TÉCNICO</h3><p>El rol es automático para toda cuenta técnica. No es un rol administrativo y no tiene acceso al backoffice. Las capacidades se aplican sobre las órdenes asignadas al técnico.</p></div><div className="technician-permission-list"><span>✓ Consultar órdenes asignadas</span><span>✓ Actualizar diagnóstico y registro técnico</span><span>✓ Cambiar estados técnicos permitidos</span><span>✓ Registrar y actualizar dispositivos recibidos</span><span>✓ Subir evidencia fotográfica de la reparación</span><span>✓ Editar su propio perfil</span></div></section>
         <div className="modal-actions">{editing&&<button type="button" className="admin-button" onClick={reset}>Cancelar</button>}<button className="admin-button primary" disabled={saving} type="submit">{saving?"Guardando…":editing?"Guardar cambios":"Crear técnico"}</button></div>
       </form>
     </AdminPanel>
     <AdminPanel>
       <AdminSectionHeading kicker="Personal" title="Técnicos registrados" meta={<span className="muted">{items.length} cuentas</span>}/>
       {loading?<AdminLoadingState label="Cargando técnicos…"/>:<AdminTable headers={["Técnico","Rol","Contacto","Estado","Último acceso","Acciones"]} empty={!items.length?<AdminEmptyState icon="♟" title="No hay técnicos registrados" description="Crea la primera cuenta técnica para comenzar a asignar órdenes."/>:undefined}>
         {items.map(item=><tr key={item.id}><td><strong>{item.firstName} {item.lastName}</strong><span className="table-subtext">{item.email}</span></td><td><span className="status success">Técnico</span></td><td>{item.phone??"Sin teléfono"}</td><td><span className={`status ${item.active?"success":"muted-status"}`}>{item.active?"Activo":"Inactivo"}</span></td><td>{item.lastLoginAt?new Date(item.lastLoginAt).toLocaleString("es-CO"):"Nunca"}</td><td><button className="table-action" type="button" onClick={()=>edit(item)}>Editar</button><button className="table-action" type="button" onClick={()=>void toggle(item)}>{item.active?"Desactivar":"Activar"}</button></td></tr>)}
       </AdminTable>}
     </AdminPanel>
   </section>
 </AdminPageShell>;
}
