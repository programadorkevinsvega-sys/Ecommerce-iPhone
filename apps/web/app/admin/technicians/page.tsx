"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import AdminSidebar from "../AdminSidebar";

type Technician={id:string;email:string;firstName:string;lastName:string;phone:string|null;active:boolean;lastLoginAt:string|null};
const empty={email:"",firstName:"",lastName:"",phone:"",password:""};

export default function AdminTechniciansPage(){
  const [items,setItems]=useState<Technician[]>([]);
  const [form,setForm]=useState(empty);
  const [editing,setEditing]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);

  async function load(){
    const response=await fetch("/api/admin/technicians",{cache:"no-store",credentials:"same-origin"});
    if(response.status===401||response.status===403){window.location.href="/admin/login";return;}
    const data=await response.json() as {items?:Technician[];error?:string};
    if(!response.ok){setMessage(data.error??"No se pudieron cargar los técnicos.");return;}
    setItems(data.items??[]);
  }
  useEffect(()=>{void load()},[]);

  async function save(event:React.FormEvent){
    event.preventDefault();setLoading(true);setMessage("");
    const body={...form,...(editing?{id:editing}:{})};
    const response=await fetch("/api/admin/technicians",{method:editing?"PATCH":"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),credentials:"same-origin",cache:"no-store"});
    const data=await response.json() as {error?:string};
    setMessage(response.ok?(editing?"Técnico actualizado.":"Técnico creado."):data.error??"No se pudo guardar el técnico.");
    if(response.ok){setForm(empty);setEditing(null);await load();}
    setLoading(false);
  }

  async function toggle(item:Technician){
    const response=await fetch("/api/admin/technicians",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:item.id,active:!item.active}),credentials:"same-origin",cache:"no-store"});
    const data=await response.json() as {error?:string};
    setMessage(response.ok?"Estado actualizado.":data.error??"No se pudo actualizar.");
    if(response.ok)await load();
  }

  function edit(item:Technician){
    setEditing(item.id);
    setForm({email:item.email,firstName:item.firstName,lastName:item.lastName,phone:item.phone??"",password:""});
  }

  return <main className="admin-shell">
    <AdminSidebar active="technicians"/>
    <section className="admin-content">
      <header className="admin-topbar"><div><p className="admin-kicker">Personal técnico</p><h1>Técnicos</h1><p>Cuentas de empleados técnicas independientes del panel administrativo.</p></div><Link href="/admin" className="admin-button">Volver</Link></header>
      <section className="admin-workspace">
        <form className="admin-form" onSubmit={save}>
          <div className="form-grid">
            <label>Correo<input required type="email" value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))}/></label>
            <label>Nombre<input required value={form.firstName} onChange={e=>setForm(v=>({...v,firstName:e.target.value}))}/></label>
            <label>Apellido<input required value={form.lastName} onChange={e=>setForm(v=>({...v,lastName:e.target.value}))}/></label>
            <label>Teléfono<input value={form.phone} onChange={e=>setForm(v=>({...v,phone:e.target.value}))}/></label>
            <label>Contraseña<input type="password" required={!editing} autoComplete="new-password" value={form.password} onChange={e=>setForm(v=>({...v,password:e.target.value}))}/></label>
          </div>
          {message&&<p role="status">{message}</p>}
          <div className="modal-actions"><button className="admin-button primary" disabled={loading}>{editing?"Actualizar técnico":"Crear técnico"}</button>{editing&&<button type="button" className="admin-button" onClick={()=>{setEditing(null);setForm(empty)}}>Cancelar</button>}</div>
        </form>
        <div className="admin-table-wrap">
          <table className="admin-table"><thead><tr><th>Técnico</th><th>Contacto</th><th>Estado</th><th>Último acceso</th><th>Acciones</th></tr></thead><tbody>
            {items.map(item=><tr key={item.id}><td><strong>{item.firstName} {item.lastName}</strong><span className="table-subtext">{item.email}</span></td><td>{item.phone??"—"}</td><td>{item.active?"Activo":"Inactivo"}</td><td>{item.lastLoginAt?new Date(item.lastLoginAt).toLocaleString("es-CO"):"Nunca"}</td><td><button className="table-action" onClick={()=>edit(item)}>Editar</button><button className="table-action" onClick={()=>void toggle(item)}>{item.active?"Desactivar":"Activar"}</button></td></tr>)}
          </tbody></table>
          {!items.length&&<div className="admin-empty"><h3>No hay técnicos</h3><p>Crea la primera cuenta técnica para poder asignar órdenes.</p></div>}
        </div>
      </section>
    </section>
  </main>;
}
