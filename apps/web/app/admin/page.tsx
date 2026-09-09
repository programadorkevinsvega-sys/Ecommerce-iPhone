"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Metric = { orders:number; customers:number; products:number; openServices:number; revenueInCents:number; pendingPayments:number; lowStock:number };
type Admin = { firstName:string; lastName:string; role:string };

const money = (cents:number) => new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 }).format(cents/100);

export default function AdminPage() {
  const router = useRouter();
  const [admin,setAdmin] = useState<Admin|null>(null);
  const [metrics,setMetrics] = useState<Metric|null>(null);
  const [orders,setOrders] = useState<Record<string,unknown>[]>([]);
  const [resource,setResource] = useState("orders");
  const [items,setItems] = useState<Record<string,unknown>[]>([]);
  const [q,setQ] = useState("");
  const [error,setError] = useState("");
  useEffect(()=>{(async()=>{const auth=await fetch("/api/admin/auth");const a=await auth.json() as {authenticated:boolean;admin:Admin|null};if(!a.authenticated){router.replace("/admin/login");return;}setAdmin(a.admin);const d=await fetch("/api/admin/dashboard");if(d.ok){const x=await d.json() as {metrics:Metric;recentOrders:Record<string,unknown>[]};setMetrics(x.metrics);setOrders(x.recentOrders);} })();},[router]);
  useEffect(()=>{if(!admin)return;fetch(`/api/admin/resources?resource=${resource}&q=${encodeURIComponent(q)}`).then(async r=>{const d=await r.json() as {items?:Record<string,unknown>[];error?:string};if(!r.ok){setError(d.error??"Error");return;}setItems(d.items??[]);setError("");});},[admin,resource,q]);
  async function logout(){await fetch("/api/admin/auth",{method:"DELETE"});router.replace("/admin/login");}
  async function update(id:string,status:string){const r=await fetch("/api/admin/resources",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({resource,id,status})});if(r.ok)setItems(x=>x.map(i=>i.id===id?{...i,status}:i));else setError("No autorizado o actualización inválida");}
  if(!admin)return <main style={{padding:32}}>Cargando panel…</main>;
  return <main style={{padding:24,maxWidth:1400,margin:"0 auto",display:"grid",gap:24}}>
    <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}><div><p>ADMIN · {admin.role}</p><h1>Operaciones</h1><p>{admin.firstName} {admin.lastName}</p></div><button onClick={logout}>Cerrar sesión</button></header>
    {metrics&&<section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12}}>{[["Pedidos",metrics.orders],["Clientes",metrics.customers],["Productos",metrics.products],["Servicios abiertos",metrics.openServices],["Ingresos",money(metrics.revenueInCents)],["Pagos pendientes",metrics.pendingPayments],["Stock bajo",metrics.lowStock]].map(([label,value])=><article key={String(label)} style={{padding:18,border:"1px solid #ddd",borderRadius:16}}><small>{label}</small><strong style={{display:"block",fontSize:26,marginTop:8}}>{value}</strong></article>)}</section>}
    <nav style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[["orders","Pedidos"],["products","Productos"],["customers","Clientes"],["services","Servicios"]].map(([key,label])=><button key={key} onClick={()=>setResource(key)}>{label}</button>)}</nav>
    <input placeholder="Buscar…" value={q} onChange={e=>setQ(e.target.value)} />
    {error&&<p role="alert">{error}</p>}
    <section style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th>Identificador</th><th>Detalle</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{items.map(item=><tr key={String(item.id)}><td>{String(item.order_number??item.name??item.email??item.id)}</td><td>{String(item.email??item.model??item.device_model??"")}</td><td>{String(item.status??(item.active===1?"ACTIVE":"INACTIVE"))}</td><td>{item.status&&<select value={String(item.status)} onChange={e=>update(String(item.id),e.target.value)}><option value={String(item.status)}>{String(item.status)}</option>{(resource==="orders"?["PROCESSING","READY_TO_SHIP","SHIPPED","DELIVERED","CANCELLED"]:resource==="services"?["PROCESSING","WAITING_CUSTOMER","COMPLETED","REJECTED","REFUNDED"]:[]).filter(x=>x!==item.status).map(x=><option key={x} value={x}>{x}</option>)}</select>}</td></tr>)}</tbody></table></section>
    <section><h2>Pedidos recientes</h2><ul>{orders.map(o=><li key={String(o.id)}>{String(o.order_number)} · {String(o.status)} · {money(Number(o.total_in_cents??0))}</li>)}</ul></section>
  </main>;
}
