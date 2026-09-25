"use client";
import {useCallback,useEffect,useState} from "react";
import AdminPageShell from "../../AdminPageShell";
import AdminPanel from "../../AdminPanel";
import AdminSectionHeading from "../../AdminSectionHeading";
import AdminTable from "../../AdminTable";
import AdminEmptyState from "../../AdminEmptyState";
import AdminLoadingState from "../../AdminLoadingState";

type Kind="BLOG_CATEGORY"|"BLOG_POST"|"FAQ"|"LANDING_PAGE"|"BANNER"|"FEATURED";
const kinds:Kind[]=["BLOG_CATEGORY","BLOG_POST","FAQ","LANDING_PAGE","BANNER","FEATURED"];
type Item=Record<string,unknown>;
const text=(v:unknown)=>typeof v==="string"?v:"";
const json=(v:Item)=>JSON.stringify(v,null,2);

export default function ContentAdmin(){
 const[kind,setKind]=useState<Kind>("BLOG_POST"),[items,setItems]=useState<Item[]>([]),[value,setValue]=useState("{}"),[selected,setSelected]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("");
 const load=useCallback(async(k=kind)=>{setLoading(true);setError("");try{const r=await fetch("/api/admin/content?kind="+k,{cache:"no-store",credentials:"same-origin"});const d=await r.json() as{items?:Item[];error?:string};if(!r.ok)throw new Error(d.error);setItems(d.items??[]);}catch(e){setError(e instanceof Error?e.message:"No se pudo cargar el contenido.");}finally{setLoading(false);}},[kind]);
 useEffect(()=>{setSelected("");setValue("{}");void load();},[load]);
 function select(item:Item){const id=text(item.id);setSelected(id);setValue(json(item));}
 async function save(){setSaving(true);setError("");try{const parsed=JSON.parse(value) as unknown;if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("El contenido debe ser un objeto JSON.");const r=await fetch("/api/admin/content",{method:selected?"PATCH":"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify(selected?{kind,id:selected,value:parsed}:{kind,value:parsed})});const d=await r.json() as{error?:string};if(!r.ok)throw new Error(d.error??"No se pudo guardar.");setSelected("");setValue("{}");await load();}catch(e){setError(e instanceof Error?e.message:"No se pudo guardar el contenido.");}finally{setSaving(false);}}
 async function toggle(item:Item){const id=text(item.id);const active=Boolean(item.active);if(!id)return;setSaving(true);setError("");try{const r=await fetch("/api/admin/content",{method:"PATCH",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({kind,id,active:!active})});const d=await r.json() as{error?:string};if(!r.ok)throw new Error(d.error??"No se pudo actualizar.");await load();}catch(e){setError(e instanceof Error?e.message:"No se pudo actualizar.");}finally{setSaving(false);}}
 return <AdminPageShell active="cms" kicker="CMS editorial" title="Contenido editorial" description="Administra blog, categorías, FAQs, landing pages, banners y destacados con validación server-side.">
 {error&&<p className="admin-error" role="alert">{error}</p>}
 <section className="admin-workspace admin-page-grid"><AdminPanel><AdminSectionHeading kicker="Editor" title={selected?"Editar contenido":"Nuevo contenido"} actions={selected?<button className="admin-button" type="button" onClick={()=>{setSelected("");setValue("{}");}}>Nuevo</button>:undefined}/>
 <label>Tipo<select value={kind} onChange={e=>setKind(e.target.value as Kind)}>{kinds.map(k=><option key={k}>{k}</option>)}</select></label>
 <label>Contenido JSON<textarea rows={24} value={value} onChange={e=>setValue(e.target.value)} spellCheck={false}/></label>
 <button className="admin-button primary" disabled={saving} onClick={()=>void save()}>{saving?"Guardando…":selected?"Guardar cambios":"Crear contenido"}</button></AdminPanel>
 <AdminPanel><AdminSectionHeading kicker="Registros" title={kind} meta={<span className="muted">{items.length} registros</span>}/>{loading?<AdminLoadingState label="Cargando contenido…"/>:<AdminTable headers={["ID","Estado","Identificador","Acciones"]} empty={!items.length?<AdminEmptyState title="No hay registros"/>:undefined}>{items.map(x=><tr key={text(x.id)}><td>{text(x.id)||"—"}</td><td>{text(x.status)||String(x.active??"—")}</td><td>{text(x.slug)||text(x.placement)||text(x.contentId)||"—"}</td><td><button className="table-action" type="button" onClick={()=>select(x)}>Editar</button>{typeof x.active==="boolean"&&<button className="table-action" type="button" disabled={saving} onClick={()=>void toggle(x)}>{x.active?"Desactivar":"Activar"}</button>}</td></tr>)}</AdminTable>}</AdminPanel></section></AdminPageShell>;
}