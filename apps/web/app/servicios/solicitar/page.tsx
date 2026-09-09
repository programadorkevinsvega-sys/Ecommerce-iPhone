"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type ServiceType={code:string;name:string;description:string;workflow:{customerOwnershipProofRequired:boolean;quoteRequired:boolean;paymentRequired:boolean}};

export default function RequestServicePage(){
  const [types,setTypes]=useState<ServiceType[]>([]);
  const [type,setType]=useState("");
  const [loading,setLoading]=useState(false);
  const [loadingTypes,setLoadingTypes]=useState(true);
  const [message,setMessage]=useState("");
  useEffect(()=>{fetch("/api/services").then(r=>r.json()).then(j=>{const available=(j.services??[]) as ServiceType[];setTypes(available);setType(available[0]?.code??"");}).catch(()=>setMessage("No fue posible cargar los servicios disponibles")).finally(()=>setLoadingTypes(false));},[]);
  const selected=types.find(x=>x.code===type);
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setLoading(true);setMessage("");const data=Object.fromEntries(new FormData(e.currentTarget).entries());data.type=type;const r=await fetch("/api/services",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});const j=await r.json();setLoading(false);if(!r.ok){setMessage(j.error??"No fue posible crear la solicitud");return;}window.location.href="/servicios/solicitud/"+j.request.id;}
  return <main className="store-shell"><header className="store-header"><Link className="brand" href="/">Ecommerce iPhone</Link><nav><Link href="/servicios">Servicios</Link><Link href="/catalog">Catálogo</Link></nav></header><section className="catalog-hero"><p className="eyebrow">Solicitud técnica</p><h1>Cuéntanos qué necesita tu dispositivo.</h1><p>Los servicios y sus requisitos se configuran desde el catálogo operativo.</p></section><form className="checkout-card" onSubmit={submit}>{loadingTypes?<p>Cargando servicios…</p>:<><label>Servicio<select required value={type} onChange={e=>setType(e.target.value)}>{types.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select></label>{selected&&<p>{selected.description}{selected.workflow.quoteRequired?" Se requiere cotización.":""}{selected.workflow.paymentRequired?" Requiere pago según la configuración.":""}</p>}<label>Correo<input required name="email" type="email" placeholder="tu@email.com"/></label><div className="form-grid"><label>Marca<input required name="deviceBrand" placeholder="Apple"/></label><label>Modelo<input required name="deviceModel" placeholder="iPhone 17 Pro"/></label></div>{type==="CARRIER_UNLOCK"&&<label>Operador actual<input required name="carrier" placeholder="Operador"/></label>}<div className="form-grid"><label>IMEI (opcional)<input name="imei" inputMode="numeric" maxLength={20} placeholder="Solo se almacenan los últimos 4"/></label><label>Serial (opcional)<input name="serial" maxLength={30} placeholder="Solo se almacenan los últimos 4"/></label></div><label>Describe el problema o servicio requerido<textarea required name="problemDescription" rows={5} placeholder="Qué sucede, desde cuándo y qué necesitas..."/></label><label>Notas adicionales<textarea name="customerNotes" rows={3}/></label>{message&&<p role="alert">{message}</p>}<button className="primary-button" disabled={loading||!type}>{loading?"Enviando…":"Crear solicitud"}</button></>}</form></main>
}
