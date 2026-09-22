"use client";

import { useEffect, useState, type FormEvent } from "react";
import AdminPageShell from "../AdminPageShell";
import AdminPanel from "../AdminPanel";
import AdminSectionHeading from "../AdminSectionHeading";
import AdminTable from "../AdminTable";
import AdminEmptyState from "../AdminEmptyState";
import AdminLoadingState from "../AdminLoadingState";

type Part={id:string;sku:string;name:string;quality:string;supplier?:string;lot?:string;unitCostInCents:number;salePriceInCents:number;stock:number;minimumStock:number};
type FormState={sku:string;name:string;quality:string;unitCostInCents:string;salePriceInCents:string;stock:string;minimumStock:string;supplier:string;lot:string};
const emptyForm:FormState={sku:"",name:"",quality:"OEM",unitCostInCents:"0",salePriceInCents:"0",stock:"0",minimumStock:"0",supplier:"",lot:""};

export default function RepairPartsPage(){
 const [items,setItems]=useState<Part[]>([]),[form,setForm]=useState(emptyForm),[message,setMessage]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 async function load(){setLoading(true);try{const r=await fetch("/api/admin/repair-parts",{cache:"no-store",credentials:"same-origin"});if(r.status===401||r.status===403){window.location.href="/admin/login";return;}const b=await r.json() as {items?:Part[];error?:string};if(!r.ok){setError(b.error??"No se pudo cargar el inventario.");return;}setItems(b.items??[]);}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setMessage("");setError("");try{const r=await fetch("/api/admin/repair-parts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...form,unitCostInCents:Number(form.unitCostInCents),salePriceInCents:Number(form.salePriceInCents),stock:Number(form.stock),minimumStock:Number(form.minimumStock)}),credentials:"same-origin",cache:"no-store"});const b=await r.json() as {error?:string};if(!r.ok){setError(b.error??"No se pudo guardar el repuesto.");return;}setMessage("Repuesto guardado correctamente.");setForm(emptyForm);await load();}finally{setBusy(false);}}
 return <AdminPageShell active="repair-parts" kicker="Taller" title="Repuestos de taller" description="Gestiona el inventario real de repuestos disponible para las órdenes del taller.">
   {error&&<p className="admin-error" role="alert">{error}</p>}{message&&<p className="admin-notice" role="status">{message}</p>}
   <section className="admin-workspace admin-page-grid">
     <AdminPanel><AdminSectionHeading kicker="Inventario" title="Registrar repuesto" meta={<span className="muted">Los datos se guardan en D1.</span>}/><form className="admin-form" onSubmit={save}><div className="form-grid"><label>SKU<input required maxLength={80} value={form.sku} onChange={(e)=>setForm({...form,sku:e.target.value})}/></label><label>Nombre<input required maxLength={160} value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></label><label>Calidad<select value={form.quality} onChange={(e)=>setForm({...form,quality:e.target.value})}><option>ORIGINAL</option><option>OEM</option><option>AFTERMARKET</option></select></label><label>Proveedor<input maxLength={160} value={form.supplier} onChange={(e)=>setForm({...form,supplier:e.target.value})}/></label><label>Lote<input maxLength={100} value={form.lot} onChange={(e)=>setForm({...form,lot:e.target.value})}/></label><label>Costo en centavos<input type="number" min="0" value={form.unitCostInCents} onChange={(e)=>setForm({...form,unitCostInCents:e.target.value})}/></label><label>Precio al cliente en centavos<input type="number" min="0" value={form.salePriceInCents} onChange={(e)=>setForm({...form,salePriceInCents:e.target.value})}/></label><label>Stock inicial<input type="number" min="0" value={form.stock} onChange={(e)=>setForm({...form,stock:e.target.value})}/></label><label>Stock mínimo<input type="number" min="0" value={form.minimumStock} onChange={(e)=>setForm({...form,minimumStock:e.target.value})}/></label></div><div className="modal-actions"><button className="admin-button primary" disabled={busy}>{busy?"Guardando…":"Guardar repuesto"}</button></div></form></AdminPanel>
     <AdminPanel><AdminSectionHeading kicker="Existencias" title="Inventario registrado" meta={<span className="muted">{items.length} repuestos</span>}/><div className="admin-table-wrap">{loading?<AdminLoadingState label="Cargando repuestos…"/>:<AdminTable headers={["SKU","Repuesto","Calidad","Proveedor","Stock","Mínimo"]} empty={!items.length?<AdminEmptyState title="No hay repuestos registrados" description="Agrega inventario real del taller para reservarlo en una orden."/>:undefined}>{items.map(item=><tr key={item.id}><td><strong>{item.sku}</strong><span className="table-subtext">{item.lot??"Sin lote"}</span></td><td>{item.name}</td><td>{item.quality}</td><td>{item.supplier??"Sin proveedor"}</td><td className={item.stock<=item.minimumStock?"stock-low":""}>{item.stock}</td><td>{item.minimumStock}</td></tr>)}</AdminTable>}</div></AdminPanel>
   </section>
 </AdminPageShell>;
}
