"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { normalizeSearchQuery, normalizeSingleLine, safeFormError } from "../../lib/inputValidation";

type Metric = { orders: number; customers: number; products: number; openServices: number; revenueInCents: number; pendingPayments: number; lowStock: number };
type Admin = { firstName: string; lastName: string; role: string };
type ResourceItem = Record<string, unknown>;
type ResourceResponse = { items?: ResourceItem[]; error?: string };
type Category = { id: string; name: string; slug: string; active: boolean; createdAt: string; updatedAt: string };
type CategoryResponse = { items?: Category[]; category?: Category; error?: string };
type CategoryForm = { id: string | null; name: string; slug: string; active: boolean };
type ResourceName = "orders" | "products" | "customers" | "services" | "categories";

const NAV_ITEMS = [{ key:"orders",label:"Pedidos" },{ key:"products",label:"Productos" },{ key:"categories",label:"Categorías" },{ key:"customers",label:"Clientes" },{ key:"services",label:"Servicios" }] as const;
const EMPTY_CATEGORY_FORM: CategoryForm = { id: null, name: "", slug: "", active: true };
const money = (cents:number) => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(cents/100);
const statusOptions=(resource:string)=>resource==="orders"?["PROCESSING","READY_TO_SHIP","SHIPPED","DELIVERED","CANCELLED"]:resource==="services"?["PROCESSING","WAITING_CUSTOMER","COMPLETED","REJECTED","REFUNDED"]:[];
const resourceIdentifier=(item:ResourceItem)=>String(item.order_number??item.name??item.email??item.id??"");
const resourceDetail=(item:ResourceItem)=>String(item.email??item.model??item.device_model??item.slug??"");
const resourceStatus=(item:ResourceItem)=>String(item.status??(item.active===1||item.active===true?"ACTIVE":"INACTIVE"));
async function readJson<T>(response:Response):Promise<T>{ return (await response.json()) as T; }
function categorySlug(value: string): string {
  return normalizeSingleLine(value).normalize("NFD").replace(/[\u0300-\u036f]/gu,"").toLowerCase().replace(/[^a-z0-9]+/gu,"-").replace(/^-+|-+$/gu,"").replace(/-{2,}/gu,"-");
}

export default function AdminPage(){
  const router=useRouter();
  const [admin,setAdmin]=useState<Admin|null>(null);const [metrics,setMetrics]=useState<Metric|null>(null);const [orders,setOrders]=useState<ResourceItem[]>([]);const [resource,setResource]=useState<ResourceName>("orders");const [items,setItems]=useState<ResourceItem[]>([]);const [categories,setCategories]=useState<Category[]>([]);const [categoryForm,setCategoryForm]=useState<CategoryForm>(EMPTY_CATEGORY_FORM);const [q,setQ]=useState("");const [error,setError]=useState("");const [categoryError,setCategoryError]=useState("");const [loading,setLoading]=useState(true);const [resourceLoading,setResourceLoading]=useState(false);const [categoryLoading,setCategoryLoading]=useState(false);const [logoutLoading,setLogoutLoading]=useState(false);const [updatingId,setUpdatingId]=useState<string|null>(null);
  const redirectToLogin=useCallback(()=>{setAdmin(null);setMetrics(null);setOrders([]);setItems([]);setCategories([]);router.replace("/admin/login");},[router]);
  const normalizedQuery=useMemo(()=>normalizeSearchQuery(q)??"",[q]);

  const loadCategories=useCallback(async(signal?:AbortSignal)=>{setCategoryLoading(true);try{
    const init: RequestInit = { cache:"no-store", credentials:"same-origin", ...(signal ? { signal } : {}) };
    const response=await fetch(`/api/admin/categories?q=${encodeURIComponent(normalizedQuery)}`,init);
    const data=await readJson<CategoryResponse>(response);
    if(response.status===401||response.status===403){redirectToLogin();return;}
    if(!response.ok){setCategoryError(safeFormError(response.status,data.error??"No se pudieron cargar las categorías."));return;}
    setCategories(data.items??[]);setCategoryError("");
  }catch(error){if(signal?.aborted)return;setCategoryError("No fue posible cargar las categorías.");}finally{if(!signal?.aborted)setCategoryLoading(false);}},[normalizedQuery,redirectToLogin]);

  useEffect(()=>{
    const controller=new AbortController();let active=true;
    async function loadSession(){try{
      const auth=await fetch("/api/admin/auth",{cache:"no-store",credentials:"same-origin",signal:controller.signal});const data=await readJson<{authenticated:boolean;admin:Admin|null}>(auth);if(!active)return;
      if(!auth.ok||!data.authenticated||!data.admin){redirectToLogin();return;}setAdmin(data.admin);
      const dashboard=await fetch("/api/admin/dashboard",{cache:"no-store",credentials:"same-origin",signal:controller.signal});if(!active)return;
      if(dashboard.status===401||dashboard.status===403){redirectToLogin();return;}if(!dashboard.ok){setError("No se pudo cargar el panel administrativo.");return;}
      const dashboardData=await readJson<{metrics:Metric;recentOrders:ResourceItem[]}>(dashboard);if(active){setMetrics(dashboardData.metrics);setOrders(dashboardData.recentOrders);}
    }catch(error){if(controller.signal.aborted)return;setError("No fue posible verificar la sesión administrativa.");}finally{if(active)setLoading(false);}}
    void loadSession();return()=>{active=false;controller.abort();};
  },[redirectToLogin]);

  useEffect(()=>{if(!admin)return;const controller=new AbortController();let active=true;
    async function loadResources(){try{
      if(resource==="categories"){await loadCategories(controller.signal);return;}
      setResourceLoading(true);
      const response=await fetch(`/api/admin/resources?resource=${encodeURIComponent(resource)}&q=${encodeURIComponent(normalizedQuery)}`,{cache:"no-store",credentials:"same-origin",signal:controller.signal});
      const data=await readJson<ResourceResponse>(response);if(!active)return;
      if(response.status===401||response.status===403){redirectToLogin();return;}
      if(!response.ok){setError(safeFormError(response.status,data.error??"No se pudo cargar el recurso."));return;}
      setItems(data.items??[]);setError("");
    }catch(error){if(controller.signal.aborted)return;setError("No fue posible cargar el recurso administrativo.");}finally{if(active)setResourceLoading(false);}}
    void loadResources();return()=>{active=false;controller.abort();};
  },[admin,resource,normalizedQuery,redirectToLogin,loadCategories]);

  useEffect(()=>{const onPageShow=(event:PageTransitionEvent)=>{if(event.persisted)window.location.reload();};window.addEventListener("pageshow",onPageShow);return()=>window.removeEventListener("pageshow",onPageShow);},[]);
  async function logout(){setLogoutLoading(true);try{await fetch("/api/admin/auth",{method:"DELETE",cache:"no-store",credentials:"same-origin"});}finally{redirectToLogin();}}
  async function update(id:string,status:string){setUpdatingId(id);setError("");try{const response=await fetch("/api/admin/resources",{method:"PATCH",cache:"no-store",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({resource,id,status})});if(response.status===401||response.status===403){redirectToLogin();return;}if(!response.ok){const data=await readJson<ResourceResponse>(response);setError(safeFormError(response.status,data.error??"No autorizado o actualización inválida"));return;}setItems(current=>current.map(item=>String(item.id)===id?{...item,status}:item));}catch{setError("No fue posible actualizar el recurso.");}finally{setUpdatingId(null);}}
  async function submitCategory(event:FormEvent<HTMLFormElement>){event.preventDefault();setCategoryError("");const name=normalizeSingleLine(categoryForm.name);const slug=categorySlug(categoryForm.slug||name);if(!name||name.length>100||!slug){setCategoryError("Revisa los datos ingresados e inténtalo nuevamente.");return;}setCategoryLoading(true);try{const response=await fetch(categoryForm.id?`/api/admin/categories/${encodeURIComponent(categoryForm.id)}`:"/api/admin/categories",{method:categoryForm.id?"PATCH":"POST",cache:"no-store",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,slug,active:categoryForm.active})});const data=await readJson<CategoryResponse>(response);if(response.status===401||response.status===403){redirectToLogin();return;}if(!response.ok){setCategoryError(safeFormError(response.status,data.error??"No fue posible guardar la categoría."));return;}setCategoryForm(EMPTY_CATEGORY_FORM);await loadCategories();}catch{setCategoryError("No fue posible guardar la categoría.");}finally{setCategoryLoading(false);}}
  async function deactivateCategory(category:Category){setCategoryError("");setUpdatingId(category.id);try{const response=await fetch(`/api/admin/categories/${encodeURIComponent(category.id)}`,{method:"DELETE",cache:"no-store",credentials:"same-origin"});const data=await readJson<CategoryResponse>(response);if(response.status===401||response.status===403){redirectToLogin();return;}if(!response.ok){setCategoryError(safeFormError(response.status,data.error??"No fue posible desactivar la categoría."));return;}await loadCategories();}catch{setCategoryError("No fue posible desactivar la categoría.");}finally{setUpdatingId(null);}}

  if(loading)return <main style={{padding:32}} aria-busy="true">Verificando sesión…</main>;
  if(!admin)return null;
  const cards=metrics?[["Pedidos",metrics.orders],["Clientes",metrics.customers],["Productos",metrics.products],["Servicios abiertos",metrics.openServices],["Ingresos",money(metrics.revenueInCents)],["Pagos pendientes",metrics.pendingPayments],["Stock bajo",metrics.lowStock]] as const:[];

  return <main style={{padding:24,maxWidth:1400,margin:"0 auto",display:"grid",gap:24}}>
    <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}><div><p>ADMIN · {admin.role}</p><h1>Operaciones</h1><p>{admin.firstName} {admin.lastName}</p></div><button type="button" disabled={logoutLoading} onClick={logout}>{logoutLoading?"Cerrando…":"Cerrar sesión"}</button></header>
    {metrics&&<section aria-label="Métricas" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12}}>{cards.map(([label,value])=><article key={label} style={{padding:18,border:"1px solid #ddd",borderRadius:16}}><small>{label}</small><strong style={{display:"block",fontSize:26,marginTop:8}}>{value}</strong></article>)}</section>}
    <nav aria-label="Recursos administrativos" style={{display:"flex",gap:8,flexWrap:"wrap"}}>{NAV_ITEMS.map(item=><button type="button" key={item.key} disabled={updatingId!==null} onClick={()=>setResource(item.key)} aria-pressed={resource===item.key}>{item.label}</button>)}</nav>
    <label htmlFor="admin-resource-search">Buscar</label><input id="admin-resource-search" type="search" inputMode="search" autoComplete="off" maxLength={100} placeholder="Buscar…" value={q} onChange={e=>setQ(e.target.value)} aria-label="Buscar en recursos administrativos" />
    {resource==="categories"?<section aria-label="Gestión de categorías" style={{display:"grid",gridTemplateColumns:"minmax(260px,380px) 1fr",gap:24,alignItems:"start"}}>
      <form onSubmit={submitCategory} style={{display:"grid",gap:12,padding:18,border:"1px solid #ddd",borderRadius:16}}>
        <h2>{categoryForm.id?"Editar categoría":"Crear categoría"}</h2>
        <label htmlFor="category-name">Nombre</label><input id="category-name" required minLength={1} maxLength={100} value={categoryForm.name} onChange={e=>setCategoryForm(current=>({ ...current, name:e.target.value, slug: current.id ? current.slug : categorySlug(e.target.value) }))} />
        <label htmlFor="category-slug">Slug</label><input id="category-slug" required minLength={1} maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={categoryForm.slug} onChange={e=>setCategoryForm(current=>({ ...current, slug:categorySlug(e.target.value) }))} />
        <label style={{display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" checked={categoryForm.active} onChange={e=>setCategoryForm(current=>({ ...current, active:e.target.checked }))} /> Activa</label>
        {categoryError&&<p role="alert">{categoryError}</p>}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="submit" disabled={categoryLoading}>{categoryLoading?"Guardando…":categoryForm.id?"Guardar cambios":"Crear categoría"}</button>{categoryForm.id&&<button type="button" disabled={categoryLoading} onClick={()=>setCategoryForm(EMPTY_CATEGORY_FORM)}>Cancelar</button>}</div>
      </form>
      <div style={{overflowX:"auto"}} aria-busy={categoryLoading}>
        {categoryLoading&&categories.length===0?<p>Cargando categorías…</p>:categories.length===0?<div className="empty-state"><h2>No hay categorías registradas.</h2><p>Crea la primera categoría desde el panel administrativo.</p></div>:<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th scope="col">Nombre</th><th scope="col">Slug</th><th scope="col">Estado</th><th scope="col">Acción</th></tr></thead><tbody>{categories.map(category=><tr key={category.id}><td>{category.name}</td><td>{category.slug}</td><td>{category.active?"ACTIVE":"INACTIVE"}</td><td><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" disabled={updatingId!==null} onClick={()=>setCategoryForm({id:category.id,name:category.name,slug:category.slug,active:category.active})}>Editar</button><button type="button" disabled={updatingId!==null||!category.active} onClick={()=>void deactivateCategory(category)}>Desactivar</button></div></td></tr>)}</tbody></table>}
      </div>
    </section>:<>
      {error&&<p role="alert">{error}</p>}
      <section aria-label="Resultados administrativos" style={{overflowX:"auto"}} aria-busy={resourceLoading}>{resourceLoading&&items.length===0?<p>Cargando recurso…</p>:<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th scope="col">Identificador</th><th scope="col">Detalle</th><th scope="col">Estado</th><th scope="col">Acción</th></tr></thead><tbody>{items.map(item=>{const currentStatus=typeof item.status==="string"?item.status:undefined;const options=statusOptions(resource).filter(option=>option!==currentStatus);const id=String(item.id);return <tr key={id}><td>{resourceIdentifier(item)}</td><td>{resourceDetail(item)}</td><td>{resourceStatus(item)}</td><td>{currentStatus&&<label><span className="sr-only">Estado de {resourceIdentifier(item)}</span><select aria-label={`Cambiar estado de ${resourceIdentifier(item)}`} disabled={updatingId!==null} value={currentStatus} onChange={e=>void update(id,e.target.value)}><option value={currentStatus}>{currentStatus}</option>{options.map(option=><option key={option} value={option}>{option}</option>)}</select></label>}</td></tr>;})}</tbody></table>}</section>
    </>}
    <section aria-label="Pedidos recientes"><h2>Pedidos recientes</h2><ul>{orders.map(order=><li key={String(order.id)}>{String(order.order_number)} · {String(order.status)} · {money(Number(order.total_in_cents??0))}</li>)}</ul></section>
  </main>;
}
