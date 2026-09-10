"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import type {ProductVariant} from "../../../modules/catalog/application/ProductVariants";
const money=(c:number)=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(c/100);
export function ProductPurchasePanel({productId,basePrice,variants,disabled}:{productId:string;basePrice:number;variants:readonly ProductVariant[];disabled?:boolean}){
 const [variantId,setVariantId]=useState(variants[0]?.id??"");const [busy,setBusy]=useState(false);const [added,setAdded]=useState(false);const [error,setError]=useState("");
 const variant=useMemo(()=>variants.find(v=>v.id===variantId),[variants,variantId]);const price=variant?.priceInCents??basePrice;
 async function add(){if(busy||disabled)return;setBusy(true);setError("");try{const r=await fetch("/api/cart",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({productId,variantId:variant?.id,quantity:1})});const data=await r.json();if(!r.ok)throw new Error(data.error??"No se pudo agregar");setAdded(true);}catch(e){setError(e instanceof Error?e.message:"No se pudo agregar");}finally{setBusy(false);}}
 return <div className="purchase-panel">{variants.length>0&&<label className="variant-select">Configuración<select value={variantId} onChange={e=>setVariantId(e.target.value)} disabled={busy||disabled}>{variants.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>}<div className="product-price">{money(price)}</div>{added?<Link className="button primary" href="/cart">Ir al carrito</Link>:<button className="button primary" type="button" onClick={add} disabled={disabled||busy}>{busy?"Agregando…":"Agregar al carrito"}</button>}{error&&<p className="form-error" role="alert">{error}</p>}</div>;
}
