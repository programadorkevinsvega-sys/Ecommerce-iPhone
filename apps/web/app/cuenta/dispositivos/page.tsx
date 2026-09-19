"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Device={id:string;customerId:string;deviceType:string;brand:string;model:string;serialLast4:string|null;imeiLast4:string|null;color:string|null;capacity:string|null;physicalCondition:string|null;notes:string|null};

export default function DevicesPage(){
 const [devices,setDevices]=useState<Device[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{void (async()=>{try{const r=await fetch("/api/customer/devices",{cache:"no-store"});if(!r.ok)throw new Error("No se pudieron cargar tus dispositivos.");setDevices((await r.json()).devices??[])}catch(e){setError(e instanceof Error?e.message:"No se pudieron cargar tus dispositivos.")}finally{setLoading(false)}})()},[]);
 return <main className="store-shell auth-page"><section className="auth-card">
  <p className="eyebrow">Mi cuenta</p><h1>Mis dispositivos.</h1>
  <p>Consulta los equipos registrados a tu nombre. Los datos técnicos de recepción y reparación son gestionados por personal autorizado.</p>
  {error&&<p role="alert">{error}</p>}
  {loading?<p>Cargando dispositivos…</p>:!devices.length?<p>Aún no tienes dispositivos registrados. Cuando entregues un equipo para reparación, el personal del taller lo asociará a tu cuenta.</p>:
   <div className="account-list">{devices.map(d=><article className="account-row" key={d.id}><div><strong>{d.brand} {d.model}</strong><p>{d.deviceType} · {d.color??"Sin color"} · {d.capacity??"Sin capacidad"}</p><p>IMEI ••••{d.imeiLast4??"----"} · Serial ••••{d.serialLast4??"----"}</p>{d.physicalCondition&&<p>Condición registrada: {d.physicalCondition}</p>}</div></article>)}</div>}
  <p><Link href="/cuenta">Volver a mi cuenta</Link></p>
 </section></main>;
}
