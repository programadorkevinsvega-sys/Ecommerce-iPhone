"use client";

import Image from "next/image";
import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "./AdminSidebar";
import AdminLoadingState from "./AdminLoadingState";
import {
  normalizeSearchQuery,
  normalizeSingleLine,
  safeFormError,
} from "../../lib/inputValidation";

function adminImageSrc(url: string) {
  if (!url || url.startsWith("/") || url.startsWith("blob:")) return url;
  return `/api/media/proxy?url=${encodeURIComponent(url)}`;
}

type Metric = {
  orders: number;
  customers: number;
  products: number;
  openServices: number;
  revenueInCents: number;
  pendingPayments: number;
  lowStock: number;
  sales: { paidOrders: number; unitsSold: number; averageOrderValueInCents: number; refundedOrders: number };
  operations: { ordersToday: number; cancelledOrders: number; outOfStock: number };
  customersDetail: { newLast30Days: number; repeatCustomers: number };
  payments: { paid: number; failed: number; pending: number; refunded: number };
};
type Admin = { firstName: string; lastName: string; role: string };
type Item = Record<string, unknown>;
type Resource =
  | "dashboard"
  | "orders"
  | "products"
  | "categories"
  | "customers"
  | "services"
  | "service-types"
  | "home-carousel";
type Category = { id: string; name: string; slug: string; imageUrl?: string; active: boolean };
type ProductForm = {
  id: string | null;
  name: string;
  slug: string;
  brand: string;
  model: string;
  description: string;
  condition: string;
  priceInCents: string;
  stock: string;
  warrantyMonths: string;
  batteryHealth: string;
  storageGb: string;
  color: string;
  active: boolean;
  categoryIds: string[];
  imageUrls: string[];
  imageFiles: File[];
  specs: Array<{ key: string; value: string }>;
};
type CustomerForm = { id: string; firstName: string; lastName: string; phone: string };
type ServiceType = {
  code: string;
  slug: string;
  name: string;
  description: string;
  imageUrl?: string;
  category: string;
  enabled: boolean;
  workflow: {
    quoteRequired: boolean;
    paymentRequired: boolean;
    allowedStatuses: readonly string[];
  };
  priceFromInCents?: number;
  fixedPriceInCents?: number;
  estimatedMinutes?: number;
  warrantyDays?: number;
  requiresDiagnosis?: boolean;
  requiresApproval?: boolean;
  compatibility?: { brand: string; model?: string }[];
  requirements?: { description: string; required: boolean }[];
};
type ServiceTypeForm = {
  code: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  imageFile: File | null;
  category: string;
  enabled: boolean;
  quoteRequired: boolean;
  paymentRequired: boolean;
  priceFromInCents: string;
  fixedPriceInCents: string;
  estimatedMinutes: string;
  warrantyDays: string;
  requiresDiagnosis: boolean;
  requiresApproval: boolean;
  compatibilityText: string;
  requirementsText: string;
};
type HomeSlide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  imageUrl: string;
  href: string;
  active: boolean;
};
type HomeSlideForm = Omit<HomeSlide, "id"> & { id: string };

const NAV: { key: Resource; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "⌂" },
  { key: "orders", label: "Pedidos", icon: "▣" },
  { key: "products", label: "Productos", icon: "▤" },
  { key: "categories", label: "Categorías", icon: "⌘" },
  { key: "customers", label: "Clientes", icon: "♙" },
  { key: "service-types", label: "Servicios ofrecidos", icon: "◇" },
  { key: "home-carousel", label: "Carrusel de inicio", icon: "▧" },
  { key: "services", label: "Solicitudes", icon: "⚙" },
];
const EMPTY_PRODUCT: ProductForm = {
  id: null,
  name: "",
  slug: "",
  brand: "",
  model: "",
  description: "",
  condition: "NEW",
  priceInCents: "",
  stock: "0",
  warrantyMonths: "12",
  batteryHealth: "",
  storageGb: "",
  color: "",
  active: true,
  categoryIds: [],
  imageUrls: [],
  imageFiles: [],
  specs: [],
};
const money = (cents: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
const value = (item: Item, ...keys: string[]) => {
  for (const key of keys)
    if (item[key] !== undefined && item[key] !== null) return String(item[key]);
  return "";
};
const slugify = (text: string) =>
  normalizeSingleLine(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function AdminPageContent({ fixedResource }: { fixedResource?: Resource } = {}) {
  const router = useRouter();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [metrics, setMetrics] = useState<Metric | null>(null);
  const resource: Resource = fixedResource ?? "dashboard";
  useEffect(() => {
    setSearch("");
    setError("");
    setNotice("");
  }, [resource]);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [resourceLoading, setResourceLoading] = useState(resource !== "dashboard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [productForm, setProductForm] = useState<ProductForm | null>(null);
  const [customerForm, setCustomerForm] = useState<CustomerForm | null>(null);
  const [categoryForm, setCategoryForm] = useState<{
    id: string;
    name: string;
    slug: string;
    imageUrl: string;
    imageFile: File | null;
  } | null>(null);
  const [serviceTypeForm, setServiceTypeForm] = useState<ServiceTypeForm | null>(null);
  const [homeSlides, setHomeSlides] = useState<HomeSlide[]>([]);
  const [homeSlideForm, setHomeSlideForm] = useState<HomeSlideForm | null>(null);
  const [homeSlidePreview, setHomeSlidePreview] = useState<HomeSlide | null>(null);
  const [homeCmsId, setHomeCmsId] = useState("");
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryPreview, setCategoryPreview] = useState<Category | null>(null);
  const [serviceAction, setServiceAction] = useState<string | null>(null);
  const query = useMemo(() => normalizeSearchQuery(search) ?? "", [search]);
  const login = useCallback(() => {
    setAdmin(null);
    router.replace("/admin/login");
  }, [router]);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setBusy(true);
      setResourceLoading(true);
      setError("");
      try {
        const endpoint =
          resource === "categories"
            ? `/api/admin/categories?q=${encodeURIComponent(query)}`
            : resource === "customers"
              ? `/api/admin/customers?q=${encodeURIComponent(query)}`
              : resource === "service-types"
                ? "/api/admin/service-types"
                : resource === "home-carousel"
                  ? "/api/admin/cms"
                  : `/api/admin/resources?resource=${resource}&q=${encodeURIComponent(query)}`;
        const init: RequestInit = { cache: "no-store", credentials: "same-origin" };
        if (signal) init.signal = signal;
        const response = await fetch(endpoint, init);
        if (response.status === 401 || response.status === 403) {
          login();
          return;
        }
        const data = await json<{ items?: Item[]; error?: string }>(response);
        if (!response.ok)
          throw new Error(
            safeFormError(response.status, data.error ?? "No se pudo cargar la información."),
          );
        if (resource === "categories") setCategories((data.items ?? []) as Category[]);
        else if (resource === "service-types") setServiceTypes((data.items ?? []) as ServiceType[]);
        else if (resource === "home-carousel") {
          const page = (data.items ?? [])[0] as Item | undefined;
          setHomeCmsId(value(page ?? {}, "id"));
          try {
            const content = JSON.parse(value(page ?? {}, "content")) as { slides?: HomeSlide[] };
            setHomeSlides(Array.isArray(content.slides) ? content.slides : []);
          } catch {
            setHomeSlides([]);
          }
        } else setItems(data.items ?? []);
      } catch (caught) {
        if (!signal?.aborted)
          setError(caught instanceof Error ? caught.message : "No se pudo cargar la información.");
      } finally {
        if (!signal?.aborted) {
          setBusy(false);
          setResourceLoading(false);
        }
      }
    },
    [login, query, resource],
  );
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const auth = await fetch("/api/admin/auth", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const data = await json<{ authenticated: boolean; admin: Admin | null }>(auth);
        if (!auth.ok || !data.authenticated || !data.admin) {
          login();
          return;
        }
        setAdmin(data.admin);
        const dashboard = await fetch("/api/admin/dashboard", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (dashboard.status === 401 || dashboard.status === 403) {
          login();
          return;
        }
        if (dashboard.ok) setMetrics((await json<{ metrics: Metric }>(dashboard)).metrics);
      } catch {
        if (!controller.signal.aborted) setError("No fue posible verificar la sesión.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [login]);
  useEffect(() => {
    if (admin && resource !== "dashboard") {
      const controller = new AbortController();
      void load(controller.signal);
      return () => controller.abort();
    }
  }, [admin, load, resource]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  async function logout() {
    await fetch("/api/admin/auth", {
      method: "DELETE",
      cache: "no-store",
      credentials: "same-origin",
    });
    login();
  }
  async function mutate(endpoint: string, method: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method,
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 401 || response.status === 403) {
        login();
        return false;
      }
      if (!response.ok) {
        const data = await json<{ error?: string }>(response);
        setError(safeFormError(response.status, data.error ?? "No se pudo guardar."));
        return false;
      }
      await load();
      setNotice("Cambios guardados correctamente.");
      return true;
    } catch {
      setError("No se pudo completar la operación.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    if (!productForm) return;
    const form = productForm;
    const uploadedUrls: string[] = [];
    for (const file of form.imageFiles) {
      const upload = new FormData();
      upload.set("file", file);
      const uploadResponse = await fetch("/api/admin/media?scope=product", {
        method: "POST",
        body: upload,
        credentials: "same-origin",
        cache: "no-store",
      });
      const uploadData = await json<{ url?: string; error?: string }>(uploadResponse);
      if (!uploadResponse.ok || !uploadData.url) {
        setError(uploadData.error ?? "No se pudo cargar una imagen del producto.");
        return;
      }
      uploadedUrls.push(uploadData.url);
    }
    const images = [...form.imageUrls, ...uploadedUrls];
    if (images.length > 5) {
      setError("Un producto puede tener máximo 5 imágenes.");
      return;
    }
    const body = {
      resource: "products",
      name: normalizeSingleLine(form.name),
      slug: slugify(form.slug || form.name),
      brand: normalizeSingleLine(form.brand),
      model: normalizeSingleLine(form.model),
      description: form.description.trim(),
      condition: form.condition,
      price_in_cents: Number(form.priceInCents),
      stock: Number(form.stock),
      warranty_months: Number(form.warrantyMonths),
      battery_health: form.batteryHealth === "" ? null : Number(form.batteryHealth),
      storage_gb: form.storageGb === "" ? null : Number(form.storageGb),
      color: form.color.trim() || null,
      active: form.active,
      category_ids: form.categoryIds,
      images,
      specs_json: Object.fromEntries(
        form.specs
          .map((spec) => [normalizeSingleLine(spec.key).slice(0, 80), spec.value.trim()] as const)
          .filter(([key, specValue]) => key && specValue),
      ),
    };
    const ok = await mutate(
      "/api/admin/resources",
      form.id ? "PATCH" : "POST",
      form.id ? { ...body, id: form.id } : body,
    );
    if (ok) setProductForm(null);
  }
  async function openProduct(item?: Item) {
    const product: ProductForm = item
      ? {
          id: value(item, "id") || null,
          name: value(item, "name"),
          slug: value(item, "slug"),
          brand: value(item, "brand"),
          model: value(item, "model"),
          description: value(item, "description"),
          condition: value(item, "condition") || "NEW",
          priceInCents: String(Number(item.price_in_cents ?? 0)),
          stock: value(item, "stock") || "0",
          warrantyMonths: value(item, "warranty_months") || "12",
          batteryHealth: value(item, "battery_health"),
          storageGb: value(item, "storage_gb"),
          color: value(item, "color"),
          active: item.active === 1 || item.active === true,
          categoryIds: [],
          imageUrls: (() => {
            try {
              return JSON.parse(value(item, "image_urls"));
            } catch {
              return [];
            }
          })(),
          imageFiles: [],
          specs: (() => {
            try {
              const parsed = JSON.parse(value(item, "specs_json"));
              return parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? Object.entries(parsed as Record<string, unknown>).map(([key, specValue]) => ({
                    key,
                    value: String(specValue ?? ""),
                  }))
                : [];
            } catch {
              return [];
            }
          })(),
        }
      : { ...EMPTY_PRODUCT };
    const response = await fetch("/api/admin/categories", {
      cache: "no-store",
      credentials: "same-origin",
    });
    const categoryData = await json<{ items?: Category[] }>(response);
    setCategories(categoryData.items ?? []);
    if (item && product.id) {
      const linkResponse = await fetch(
        `/api/admin/products/${encodeURIComponent(product.id)}/categories`,
        { cache: "no-store", credentials: "same-origin" },
      );
      const linkData = await json<{ categoryIds?: string[] }>(linkResponse);
      product.categoryIds = linkData.categoryIds ?? [];
    }
    setProductForm(product);
  }
  async function submitCustomer(event: FormEvent) {
    event.preventDefault();
    if (!customerForm) return;
    const ok = await mutate("/api/admin/customers", "PATCH", customerForm);
    if (ok) setCustomerForm(null);
  }
  async function deleteCustomer(id: string) {
    if (!window.confirm("¿Eliminar este cliente? Sus pedidos históricos conservarán sus datos."))
      return;
    const response = await fetch("/api/admin/customers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
      cache: "no-store",
    });
    if (!response.ok) setError("No se pudo eliminar el cliente.");
    else await load();
  }
  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    if (!categoryForm) return;
    setCategoryBusy(true);
    const endpoint = categoryForm.id
      ? `/api/admin/categories/${encodeURIComponent(categoryForm.id)}`
      : "/api/admin/categories";
    let imageUrl = categoryForm.imageUrl;
    if (categoryForm.imageFile) {
      const upload = new FormData();
      upload.set("file", categoryForm.imageFile);
      const uploadResponse = await fetch("/api/admin/media?scope=category", {
        method: "POST",
        body: upload,
        credentials: "same-origin",
        cache: "no-store",
      });
      const uploadData = await json<{ url?: string; error?: string }>(uploadResponse);
      if (!uploadResponse.ok || !uploadData.url) {
        setError(uploadData.error ?? "No se pudo cargar la imagen de la categoría.");
        setCategoryBusy(false);
        return;
      }
      imageUrl = uploadData.url;
    }
    const response = await fetch(endpoint, {
      method: categoryForm.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        name: normalizeSingleLine(categoryForm.name),
        slug: slugify(categoryForm.slug || categoryForm.name),
        imageUrl,
      }),
    });
    if (!response.ok) {
      const data = await json<{ error?: string }>(response);
      setError(safeFormError(response.status, data.error ?? "No se pudo guardar la categoría."));
    } else {
      setCategoryForm(null);
      await load();
    }
    setCategoryBusy(false);
  }
  async function deactivateCategory(id: string) {
    if (!window.confirm("¿Desactivar esta categoría?")) return;
    setCategoryBusy(true);
    await fetch(`/api/admin/categories/${encodeURIComponent(id)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    await load();
    setCategoryBusy(false);
  }
  async function serviceActionRequest(
    id: string,
    action: string,
    body: Record<string, unknown> = {},
  ) {
    const ok = await mutate(`/api/admin/services/${encodeURIComponent(id)}`, "POST", {
      action,
      ...body,
    });
    if (ok) setServiceAction(null);
  }
  async function toggleHomeSlide(id: string) {
    const nextSlides = homeSlides.map((slide) =>
      slide.id === id ? { ...slide, active: !slide.active } : slide,
    );
    const response = await fetch("/api/admin/cms", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: homeCmsId || undefined,
        slug: "home-carousel",
        title: "Carrusel de inicio",
        content: JSON.stringify({ slides: nextSlides }),
        active: true,
      }),
    });
    if (!response.ok) {
      setError("No se pudo actualizar la promoción.");
      return;
    }
    const data = await json<{ id?: string }>(response);
    setHomeSlides(nextSlides);
    setHomeCmsId(data.id ?? homeCmsId);
    setNotice("Cambios guardados correctamente.");
  }
  async function saveServiceType(event: FormEvent) {
    event.preventDefault();
    if (!serviceTypeForm) return;
    const form = serviceTypeForm;
    let imageUrl = form.imageUrl;
    if (form.imageFile) {
      const upload = new FormData();
      upload.set("file", form.imageFile);
      const uploadResponse = await fetch("/api/admin/media?scope=service", { method: "POST", body: upload, credentials: "same-origin", cache: "no-store" });
      const uploadData = await json<{ url?: string; error?: string }>(uploadResponse);
      if (!uploadResponse.ok || !uploadData.url) {
        setError(uploadData.error ?? "No se pudo cargar la imagen del servicio.");
        return;
      }
      imageUrl = uploadData.url;
    }
    const response = await fetch("/api/admin/service-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        code: form.code.toUpperCase(),
        slug: slugify(form.slug || form.name),
        name: form.name,
        description: form.description,
        imageUrl,
        category: form.category,
        enabled: form.enabled,
        workflow: {
          quoteRequired: form.quoteRequired,
          paymentRequired: form.paymentRequired,
          allowedStatuses: ["PENDING", "COMPLETED", "REJECTED"],
        },
        priceFromInCents: form.priceFromInCents === "" ? undefined : Number(form.priceFromInCents),
        fixedPriceInCents: form.fixedPriceInCents === "" ? undefined : Number(form.fixedPriceInCents),
        estimatedMinutes: form.estimatedMinutes === "" ? undefined : Number(form.estimatedMinutes),
        warrantyDays: form.warrantyDays === "" ? undefined : Number(form.warrantyDays),
        requiresDiagnosis: form.requiresDiagnosis,
        requiresApproval: form.requiresApproval,
        compatibility: form.compatibilityText.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [brand = "", ...model] = line.split("|"); const modelValue = model.join("|").trim(); return { brand: brand.trim(), ...(modelValue ? { model: modelValue } : {}) }; }),
        requirements: form.requirementsText.split("\n").map((line) => line.trim()).filter(Boolean).map((description) => ({ description, required: true })),
      }),
    });
    if (!response.ok) {
      const data = await json<{ error?: string }>(response);
      setError(safeFormError(response.status, data.error ?? "No se pudo guardar el servicio."));
      return;
    }
    setServiceTypeForm(null);
    await load();
  }
  async function toggleServiceType(type: ServiceType) {
    const response = await fetch("/api/admin/service-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        code: type.code,
        slug: type.slug,
        name: type.name,
        description: type.description,
        imageUrl: type.imageUrl ?? "",
        category: type.category,
        enabled: !type.enabled,
        workflow: type.workflow,
        priceFromInCents: type.priceFromInCents,
        fixedPriceInCents: type.fixedPriceInCents,
        estimatedMinutes: type.estimatedMinutes,
        warrantyDays: type.warrantyDays,
        requiresDiagnosis: type.requiresDiagnosis,
        requiresApproval: type.requiresApproval,
        compatibility: type.compatibility ?? [],
        requirements: type.requirements ?? [],
      }),
    });
    if (!response.ok) setError("No se pudo actualizar el servicio.");
    else await load();
  }
  if (!admin)
    return (
      <main className="admin-shell">
        <AdminSidebar active={resource} />
        <section className="admin-content">
          <header className="admin-topbar">
            <div>
              <p className="admin-kicker">Panel de control</p>
              <h1>Operaciones</h1>
            </div>
          </header>
          <AdminLoadingState label="Verificando sesión…" />
        </section>
      </main>
    );
  const cards = metrics
    ? ([
        ["Pedidos", metrics.orders, "▣"],
        ["Clientes", metrics.customers, "♙"],
        ["Productos", metrics.products, "▤"],
        ["Servicios abiertos", metrics.openServices, "⚙"],
        ["Ingresos", money(metrics.revenueInCents), "$"],
        ["Pagos pendientes", metrics.pendingPayments, "◷"],
        ["Stock bajo", metrics.lowStock, "!"],
      ] as const)
    : [];
  return (
    <main className="admin-shell">
      <AdminSidebar active={resource} />
      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">Panel de control</p>
            <h1>Operaciones</h1>
          </div>
          <div className="admin-user">
            <div className="admin-avatar">
              {admin.firstName.charAt(0)}
              {admin.lastName.charAt(0)}
            </div>
            <div>
              <strong>
                {admin.firstName} {admin.lastName}
              </strong>
              <small>{admin.role}</small>
            </div>
            <button className="admin-logout" type="button" onClick={() => void logout()}>
              Salir
            </button>
          </div>
        </header>
        {resource === "dashboard" && loading ? (
          <AdminLoadingState label="Cargando panel…" />
        ) : (
          <>
            {resource === "dashboard" && (
              <section className="admin-metrics" aria-label="Resumen operativo">
            {cards.map(([label, amount, icon]) => (
              <article key={label} className="admin-metric">
                <span className="admin-metric-icon">{icon}</span>
                <div>
                  <small>{label}</small>
                  <strong>{amount}</strong>
                </div>
              </article>
            ))}
              </section>
            )}
            {error && resource === "dashboard" && (
              <p className="admin-error" role="alert">{error}</p>
            )}
            {resource === "dashboard" && metrics && (
              <section className="admin-dashboard-panels" aria-label="Métricas detalladas">
            <DashboardPanel title="Ventas">
              <DashboardMetric label="Pedidos cobrados" value={metrics.sales.paidOrders} />
              <DashboardMetric label="Unidades vendidas" value={metrics.sales.unitsSold} />
              <DashboardMetric label="Ticket promedio" value={money(metrics.sales.averageOrderValueInCents)} />
              <DashboardMetric label="Pedidos reembolsados" value={metrics.sales.refundedOrders} />
            </DashboardPanel>
            <DashboardPanel title="Operación">
              <DashboardMetric label="Pedidos hoy" value={metrics.operations.ordersToday} />
              <DashboardMetric label="Cancelados / reembolsados" value={metrics.operations.cancelledOrders} />
              <DashboardMetric label="Productos agotados" value={metrics.operations.outOfStock} />
              <DashboardMetric label="Stock bajo" value={metrics.lowStock} />
            </DashboardPanel>
            <DashboardPanel title="Clientes">
              <DashboardMetric label="Nuevos · 30 días" value={metrics.customersDetail.newLast30Days} />
              <DashboardMetric label="Clientes recurrentes" value={metrics.customersDetail.repeatCustomers} />
              <DashboardMetric label="Clientes totales" value={metrics.customers} />
            </DashboardPanel>
            <DashboardPanel title="Pagos">
              <DashboardMetric label="Pagados" value={metrics.payments.paid} />
              <DashboardMetric label="Pendientes" value={metrics.payments.pending} />
              <DashboardMetric label="Fallidos" value={metrics.payments.failed} />
              <DashboardMetric label="Reembolsados" value={metrics.payments.refunded} />
            </DashboardPanel>
          </section>
        )}
          </>
        )}
        {resource !== "dashboard" && (
          <div className="admin-workspace">
            <div className="admin-section-heading">
              <div>
                <p className="admin-kicker">Gestión</p>
                <h2>{NAV.find((item) => item.key === resource)?.label}</h2>
              </div>
              <div className="admin-toolbar">
                {resource !== "service-types" && (
                  <label className="admin-search">
                    <span>⌕</span>
                    <input
                      type="search"
                      placeholder={`Buscar ${NAV.find((item) => item.key === resource)?.label.toLowerCase()}…`}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                )}
                {resource === "products" && (
                  <button
                    className="admin-button primary"
                    type="button"
                    onClick={() => void openProduct()}
                  >
                    + Nuevo producto
                  </button>
                )}
                {resource === "categories" && (
                  <button
                    className="admin-button primary"
                    type="button"
                    onClick={() => setCategoryForm({ id: "", name: "", slug: "", imageUrl: "", imageFile: null })}
                  >
                    + Nueva categoría
                  </button>
                )}
                {resource === "service-types" && (
                  <button
                    className="admin-button primary"
                    type="button"
                    onClick={() =>
                      setServiceTypeForm({
                        code: "",
                        slug: "",
                        name: "",
                        description: "",
                        imageUrl: "",
                        imageFile: null,
                        category: "OTHER",
                        enabled: true,
                        quoteRequired: false,
                        paymentRequired: false,
                        priceFromInCents: "",
                        fixedPriceInCents: "",
                        estimatedMinutes: "",
                        warrantyDays: "",
                        requiresDiagnosis: false,
                        requiresApproval: false,
                        compatibilityText: "",
                        requirementsText: "",
                      })
                    }
                  >
                    + Nuevo servicio
                  </button>
                )}
                {resource === "home-carousel" && (
                  <button
                    className="admin-button primary"
                    type="button"
                    onClick={() =>
                      setHomeSlideForm({
                        id: crypto.randomUUID(),
                        eyebrow: "",
                        title: "",
                        description: "",
                        imageUrl: "",
                        href: "/catalog",
                        active: true,
                      })
                    }
                  >
                    + Nueva promoción
                  </button>
                )}
              </div>
            </div>
            {notice && (
              <p className="admin-notice" role="status">
                {notice}
              </p>
            )}
            {error && (
              <p className="admin-error" role="alert">
                {error}
              </p>
            )}
            {busy && <div className="admin-progress" aria-label="Actualizando" />}
            {resource === "categories" ? (
              <CategoryTable
                loading={resourceLoading}
                categories={categories}
                busy={categoryBusy}
                onEdit={(category) =>
                  setCategoryForm({ id: category.id, name: category.name, slug: category.slug, imageUrl: category.imageUrl ?? "", imageFile: null })
                }
                onView={setCategoryPreview}
                onDeactivate={(id) => void deactivateCategory(id)}
              />
            ) : resource === "products" ? (
              <ProductTable
                loading={resourceLoading}
                items={items}
                onEdit={(item) => void openProduct(item)}
                onDeactivate={(item) =>
                  void mutate("/api/admin/resources", "PATCH", {
                    resource: "products",
                    id: String(item.id),
                    active: false,
                  })
                }
              />
            ) : resource === "customers" ? (
              <CustomerTable
                loading={resourceLoading}
                items={items}
                onEdit={(item) =>
                  setCustomerForm({
                    id: value(item, "id"),
                    firstName: value(item, "firstName", "first_name"),
                    lastName: value(item, "lastName", "last_name"),
                    phone: value(item, "phone"),
                  })
                }
                onDelete={(id) => void deleteCustomer(id)}
              />
            ) : resource === "service-types" ? (
              <ServiceTypeTable
                loading={resourceLoading}
                items={serviceTypes}
                onEdit={(type) =>
                  setServiceTypeForm({
                    code: type.code,
                    slug: type.slug,
                    name: type.name,
                    description: type.description,
                    imageUrl: type.imageUrl ?? "",
                    imageFile: null,
                    category: type.category,
                    enabled: type.enabled,
                    quoteRequired: type.workflow.quoteRequired,
                    paymentRequired: type.workflow.paymentRequired,
                    priceFromInCents: type.priceFromInCents === undefined ? "" : String(type.priceFromInCents),
                    fixedPriceInCents: type.fixedPriceInCents === undefined ? "" : String(type.fixedPriceInCents),
                    estimatedMinutes: type.estimatedMinutes === undefined ? "" : String(type.estimatedMinutes),
                    warrantyDays: type.warrantyDays === undefined ? "" : String(type.warrantyDays),
                    requiresDiagnosis: type.requiresDiagnosis ?? false,
                    requiresApproval: type.requiresApproval ?? false,
                    compatibilityText: (type.compatibility ?? []).map((item) => `${item.brand}${item.model ? `|${item.model}` : ""}`).join("\n"),
                    requirementsText: (type.requirements ?? []).map((item) => item.description).join("\n"),
                  })
                }
                onToggle={(type) => void toggleServiceType(type)}
              />
            ) : resource === "home-carousel" ? (
              <HomeCarouselManager
                loading={resourceLoading}
                slides={homeSlides}
                onEdit={setHomeSlideForm}
                onView={setHomeSlidePreview}
                onToggle={(id) => void toggleHomeSlide(id)}
              />
            ) : resource === "services" ? (
              <ServiceTable
                loading={resourceLoading}
                items={items}
                onAction={(id, action) => setServiceAction(id + ":" + action)}
              />
            ) : (
              <OrderTable
                loading={resourceLoading}
                items={items}
                onStatus={(id, status) =>
                  void mutate("/api/admin/resources", "PATCH", { resource: "orders", id, status })
                }
              />
            )}
          </div>
        )}
      </section>
      {productForm && (
        <ProductModal
          form={productForm}
          categories={categories}
          setForm={setProductForm}
          onSubmit={submitProduct}
          onClose={() => setProductForm(null)}
          busy={busy}
        />
      )}
      {customerForm && (
        <CustomerModal
          form={customerForm}
          setForm={setCustomerForm}
          onSubmit={submitCustomer}
          onClose={() => setCustomerForm(null)}
          busy={busy}
        />
      )}
      {categoryForm && (
        <CategoryModal
          form={categoryForm}
          setForm={setCategoryForm}
          onSubmit={saveCategory}
          onClose={() => setCategoryForm(null)}
          busy={categoryBusy}
        />
      )}
      {categoryPreview && <CategoryPreviewModal category={categoryPreview} onClose={() => setCategoryPreview(null)} />}
      {serviceTypeForm && (
        <ServiceTypeModal
          form={serviceTypeForm}
          setForm={setServiceTypeForm}
          onSubmit={saveServiceType}
          onClose={() => setServiceTypeForm(null)}
        />
      )}
      {homeSlideForm && (
        <HomeSlideModal
          form={homeSlideForm}
          setForm={setHomeSlideForm}
          cmsId={homeCmsId}
          slides={homeSlides}
          onSaved={async (nextSlides, id) => {
            setHomeSlides(nextSlides);
            setHomeCmsId(id);
            setHomeSlideForm(null);
            setNotice("Cambios guardados correctamente.");
          }}
          onClose={() => setHomeSlideForm(null)}
        />
      )}
      {homeSlidePreview && (
        <HomeSlidePreviewModal slide={homeSlidePreview} onClose={() => setHomeSlidePreview(null)} />
      )}
      {serviceAction && (
        <ServiceActionModal
          actionValue={serviceAction}
          onClose={() => setServiceAction(null)}
          onSubmit={serviceActionRequest}
        />
      )}
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="admin-shell">
          <AdminSidebar active="dashboard" />
          <section className="admin-content">
            <header className="admin-topbar">
              <div>
                <p className="admin-kicker">Panel de control</p>
                <h1>Operaciones</h1>
              </div>
            </header>
            <AdminLoadingState label="Cargando panel…" />
          </section>
        </main>
      }
    >
      <AdminPageContent />
    </Suspense>
  );
}

function TableFrame({
  children,
  empty,
  loading = false,
  label = "Cargando información…",
}: {
  children: ReactNode;
  empty: boolean;
  loading?: boolean;
  label?: string;
}) {
  return (
    <div className="admin-table-wrap">
      {loading ? (
        <AdminLoadingState label={label} />
      ) : empty ? (
        <div className="admin-empty">
          <span>○</span>
          <h3>Sin registros todavía</h3>
          <p>Los datos reales aparecerán aquí cuando existan.</p>
        </div>
      ) : (
        <table className="admin-table">{children}</table>
      )}
    </div>
  );
}
function CategoryTable({
  categories,
  onEdit,
  onView,
  onDeactivate,
  busy,
  loading,
}: {
  categories: Category[];
  onEdit: (category: Category) => void;
  onView: (category: Category) => void;
  onDeactivate: (id: string) => void;
  busy: boolean;

  loading: boolean;}) {
  return (
    <TableFrame empty={!categories.length} loading={loading} label="Cargando categorías…">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Slug</th>
          <th>Estado</th>
          <th className="align-right">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {categories.map((category) => (
          <tr key={category.id}>
            <td>
              <strong>{category.name}</strong>
            </td>
            <td className="muted">/{category.slug}</td>
            <td>
              <span className={`status ${category.active ? "success" : "muted-status"}`}>
                {category.active ? "Activa" : "Inactiva"}
              </span>
            </td>
            <td className="align-right">
              <button className="table-action" type="button" onClick={() => onView(category)}>
                Ver
              </button>
              <button className="table-action" type="button" onClick={() => onEdit(category)}>
                Editar
              </button>
              <button
                className="table-action danger"
                disabled={busy || !category.active}
                type="button"
                onClick={() => onDeactivate(category.id)}
              >
                Desactivar
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}
function DashboardPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="admin-dashboard-panel"><h2>{title}</h2><div>{children}</div></section>;
}
function DashboardMetric({ label, value }: { label: string; value: string | number }) {
  return <article><span>{label}</span><strong>{value}</strong></article>;
}
function CategoryPreviewModal({ category, onClose }: { category: Category; onClose: () => void }) {
  return (
    <Modal title="Detalle de categoría" onClose={onClose}>
      {category.imageUrl ? <Image
        className="admin-detail-image"
        src={adminImageSrc(category.imageUrl)}
        alt={`Imagen de ${category.name}`}
        width={900}
        height={600}
        sizes="(max-width: 760px) 100vw, 680px"
      /> : <div className="admin-detail-placeholder">Sin imagen configurada</div>}
      <dl className="admin-detail-list">
        <div><dt>Nombre</dt><dd>{category.name}</dd></div>
        <div><dt>Slug</dt><dd>/{category.slug}</dd></div>
        <div><dt>Estado</dt><dd>{category.active ? "Activa" : "Inactiva"}</dd></div>
      </dl>
    </Modal>
  );
}
function ServiceTypeTable({
  items,
  onEdit,
  onToggle,
  loading,
}: {
  items: ServiceType[];
  onEdit: (item: ServiceType) => void;
  onToggle: (item: ServiceType) => void;

  loading: boolean;}) {
  return (
    <TableFrame empty={!items.length} loading={loading} label="Cargando servicios…">
      <thead>
        <tr>
          <th>Servicio</th>
          <th>Código</th>
          <th>Categoría</th>
          <th>Cotización</th>
          <th>Precio / tiempo</th>
          <th>Estado</th>
          <th className="align-right">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.code}>
            <td>
              <strong>{item.name}</strong>
              <small className="table-subtext">{item.description}</small>
            </td>
            <td className="muted">{item.code}</td>
            <td>{item.category}</td>
            <td>{item.workflow.quoteRequired ? "Requerida" : "No requerida"}</td>
            <td>{item.fixedPriceInCents !== undefined ? money(item.fixedPriceInCents) : item.priceFromInCents !== undefined ? `Desde ${money(item.priceFromInCents)}` : "Por definir"}{item.estimatedMinutes !== undefined ? ` · ${item.estimatedMinutes} min` : ""}</td>
            <td>
              <span className={`status ${item.enabled ? "success" : "muted-status"}`}>
                {item.enabled ? "Publicado" : "Oculto"}
              </span>
            </td>
            <td className="align-right">
              <button className="table-action" type="button" onClick={() => onEdit(item)}>
                Editar
              </button>
              <button className="table-action danger" type="button" onClick={() => onToggle(item)}>
                {item.enabled ? "Ocultar" : "Publicar"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}
function ProductTable({
  items,
  onEdit,
  onDeactivate,
  loading,
}: {
  items: Item[];
  onEdit: (item: Item) => void;
  onDeactivate: (item: Item) => void;

  loading: boolean;}) {
  return (
    <TableFrame empty={!items.length} loading={loading} label="Cargando productos…">
      <thead>
        <tr>
          <th>Producto</th>
          <th>Marca / modelo</th>
          <th>Precio</th>
          <th>Imágenes</th>
          <th>Inventario</th>
          <th>Estado</th>
          <th className="align-right">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={String(item.id)}>
            <td>
              <strong>{value(item, "name")}</strong>
              <small className="table-subtext">/{value(item, "slug")}</small>
            </td>
            <td>
              {value(item, "brand")} <span className="muted">{value(item, "model")}</span>
            </td>
            <td>
              <strong>{money(Number(item.price_in_cents ?? 0))}</strong>
            </td>
            <td>{value(item, "image_count") || "0"} / 5</td>
            <td>
              <span className={Number(item.stock ?? 0) <= 2 ? "stock-low" : ""}>
                {value(item, "stock")}
              </span>
            </td>
            <td>
              <span
                className={`status ${item.active === 1 || item.active === true ? "success" : "muted-status"}`}
              >
                {item.active === 1 || item.active === true ? "Activo" : "Inactivo"}
              </span>
            </td>
            <td className="align-right">
              <button className="table-action" type="button" onClick={() => onEdit(item)}>
                Editar
              </button>
              <button
                className="table-action danger"
                type="button"
                onClick={() => onDeactivate(item)}
              >
                Desactivar
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}
function CustomerTable({
  items,
  onEdit,
  onDelete,
  loading,
}: {
  items: Item[];
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;

  loading: boolean;}) {
  return (
    <TableFrame empty={!items.length} loading={loading} label="Cargando clientes…">
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Email</th>
          <th>Teléfono</th>
          <th>Registro</th>
          <th className="align-right">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={String(item.id)}>
            <td>
              <strong>
                {value(item, "firstName", "first_name")} {value(item, "lastName", "last_name")}
              </strong>
            </td>
            <td>{value(item, "email")}</td>
            <td>{value(item, "phone") || "Sin teléfono"}</td>
            <td className="muted">{value(item, "createdAt", "created_at").slice(0, 10)}</td>
            <td className="align-right">
              <button className="table-action" type="button" onClick={() => onEdit(item)}>
                Editar
              </button>
              <button
                className="table-action danger"
                type="button"
                onClick={() => onDelete(String(item.id))}
              >
                Eliminar
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}
function OrderTable({
  items,
  onStatus,
  loading,
}: {
  items: Item[];
  onStatus: (id: string, status: string) => void;

  loading: boolean;}) {
  const statuses = [
    "PENDING_PAYMENT",
    "PAID",
    "PROCESSING",
    "READY_TO_SHIP",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ];
  return (
    <TableFrame empty={!items.length} loading={loading} label="Cargando pedidos…">
      <thead>
        <tr>
          <th>Pedido</th>
          <th>Cliente</th>
          <th>Total</th>
          <th>Estado</th>
          <th>Fecha</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={String(item.id)}>
            <td>
              <strong>{value(item, "order_number")}</strong>
            </td>
            <td>{value(item, "email")}</td>
            <td>{money(Number(item.total_in_cents ?? 0))}</td>
            <td>
              <select
                className="status-select"
                value={value(item, "status")}
                onChange={(event) => onStatus(String(item.id), event.target.value)}
              >
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </td>
            <td className="muted">{value(item, "created_at").slice(0, 16)}</td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}
function ServiceTable({
  items,
  onAction,
  loading,
}: {
  items: Item[];
  onAction: (id: string, action: string) => void;

  loading: boolean;}) {
  const statuses = [
    "PENDING",
    "QUOTED",
    "PAYMENT_PENDING",
    "PAID",
    "PROCESSING",
    "WAITING_CUSTOMER",
    "COMPLETED",
    "REJECTED",
    "REFUNDED",
  ];
  return (
    <TableFrame empty={!items.length} loading={loading} label="Cargando solicitudes…">
      <thead>
        <tr>
          <th>Solicitud</th>
          <th>Cliente / equipo</th>
          <th>Tipo</th>
          <th>Estado</th>
          <th className="align-right">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={String(item.id)}>
            <td>
              <strong>{value(item, "device_model")}</strong>
              <small className="table-subtext">{value(item, "email")}</small>
            </td>
            <td>
              {value(item, "device_brand")} · {value(item, "problem_description").slice(0, 42)}
            </td>
            <td>{value(item, "type")}</td>
            <td>
              <select
                className="status-select"
                value={value(item, "status")}
                onChange={(event) => onAction(String(item.id), `transition:${event.target.value}`)}
              >
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </td>
            <td className="align-right">
              <button
                className="table-action"
                type="button"
                onClick={() => onAction(String(item.id), "quote")}
              >
                Cotizar
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="admin-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div>
            <p className="admin-kicker">Gestión</p>
            <h2>{title}</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function ProductModal({
  form,
  categories,
  setForm,
  onSubmit,
  onClose,
  busy,
}: {
  form: ProductForm;
  categories: Category[];
  setForm: (form: ProductForm) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const set = (key: keyof ProductForm, next: string | boolean) =>
    setForm({ ...form, [key]: next } as ProductForm);
  return (
    <Modal title={form.id ? "Editar producto" : "Nuevo producto"} onClose={onClose}>
      <form className="admin-form" onSubmit={onSubmit}>
        <div className="form-grid">
          <label>
            Nombre
            <input
              required
              maxLength={180}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <label>
            Slug
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={form.slug}
              onChange={(e) => set("slug", slugify(e.target.value))}
            />
          </label>
          <label>
            Marca
            <input
              required
              maxLength={80}
              value={form.brand}
              onChange={(e) => set("brand", e.target.value)}
            />
          </label>
          <label>
            Modelo
            <input
              required
              maxLength={120}
              value={form.model}
              onChange={(e) => set("model", e.target.value)}
            />
          </label>
          <label>
            Precio en COP
            <input
              required
              min="0"
              type="number"
              value={form.priceInCents}
              onChange={(e) => set("priceInCents", e.target.value)}
            />
          </label>
          <label>
            Stock
            <input
              required
              min="0"
              type="number"
              value={form.stock}
              onChange={(e) => set("stock", e.target.value)}
            />
          </label>
          <label>
            Condición
            <select value={form.condition} onChange={(e) => set("condition", e.target.value)}>
              <option>NEW</option>
              <option>USED</option>
              <option>REFURBISHED</option>
            </select>
          </label>
          <label>
            Garantía (meses)
            <input
              min="0"
              type="number"
              value={form.warrantyMonths}
              onChange={(e) => set("warrantyMonths", e.target.value)}
            />
          </label>
          <label>
            Salud de batería (%)
            <input
              min="0"
              max="100"
              type="number"
              value={form.batteryHealth}
              onChange={(e) => set("batteryHealth", e.target.value)}
            />
          </label>
          <label>
            Capacidad (GB)
            <input
              min="1"
              type="number"
              value={form.storageGb}
              onChange={(e) => set("storageGb", e.target.value)}
            />
          </label>
          <label>
            Color
            <input
              maxLength={80}
              value={form.color}
              onChange={(e) => set("color", e.target.value)}
            />
          </label>
        </div>
        <fieldset className="admin-category-picker">
          <legend>Categorías del producto</legend>
          {categories.length === 0 ? (
            <p className="form-help">Primero crea una categoría en la sección Categorías.</p>
          ) : (
            <div className="category-checks">
              {categories
                .filter((category) => category.active)
                .map((category) => (
                  <label className="checkbox-label" key={category.id}>
                    <input
                      type="checkbox"
                      checked={form.categoryIds.includes(category.id)}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          categoryIds: event.target.checked
                            ? [...form.categoryIds, category.id]
                            : form.categoryIds.filter((id) => id !== category.id),
                        })
                      }
                    />{" "}
                    {category.name}
                  </label>
                ))}
            </div>
          )}
        </fieldset>
        <label>
          Imágenes del producto (máximo 5)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              setForm({
                ...form,
                imageFiles: selected.slice(0, Math.max(0, 5 - form.imageUrls.length)),
              });
            }}
          />
          <span className="form-help">
            JPG, PNG o WebP. Las imágenes se almacenan en Cloudflare R2.
          </span>
          {form.imageUrls.length > 0 && (
            <div className="product-image-list">
              {form.imageUrls.map((url, index) => (
                <div className="product-image-item" key={url}>
                  <Image
                    src={adminImageSrc(url)}
                    alt={`Imagen ${index + 1} del producto`}
                    width={144}
                    height={144}
                    sizes="144px"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        imageUrls: form.imageUrls.filter((_, itemIndex) => itemIndex !== index),
                      })
                    }
                    aria-label={`Quitar imagen ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </label>
        <label>
          Descripción
          <textarea
            required
            maxLength={5000}
            rows={4}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </label>
        <fieldset className="admin-category-picker">
          <legend>Especificaciones del producto</legend>
          <p className="form-help">
            Añade los atributos que deben aparecer en la ficha pública del producto.
          </p>
          <div className="admin-spec-editor">
            {form.specs.map((spec, index) => (
              <div className="admin-spec-row" key={`${index}-${spec.key}`}>
                <input
                  maxLength={80}
                  placeholder="Nombre de especificación"
                  value={spec.key}
                  onChange={(event) => {
                    const specs = [...form.specs];
                    specs[index] = { ...spec, key: event.target.value };
                    setForm({ ...form, specs });
                  }}
                />
                <input
                  maxLength={500}
                  placeholder="Valor"
                  value={spec.value}
                  onChange={(event) => {
                    const specs = [...form.specs];
                    specs[index] = { ...spec, value: event.target.value };
                    setForm({ ...form, specs });
                  }}
                />
                <button
                  className="table-action danger"
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      specs: form.specs.filter((_, specIndex) => specIndex !== index),
                    })
                  }
                  aria-label="Quitar especificación"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            className="admin-button"
            type="button"
            onClick={() => setForm({ ...form, specs: [...form.specs, { key: "", value: "" }] })}
          >
            + Añadir especificación
          </button>
        </fieldset>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
          />{" "}
          Producto visible en la tienda
        </label>
        <div className="modal-actions">
          <button className="admin-button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="admin-button primary" disabled={busy} type="submit">
            {busy ? "Guardando…" : "Guardar producto"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function CustomerModal({
  form,
  setForm,
  onSubmit,
  onClose,
  busy,
}: {
  form: CustomerForm;
  setForm: (form: CustomerForm) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  busy: boolean;
}) {
  return (
    <Modal title="Editar cliente" onClose={onClose}>
      <form className="admin-form" onSubmit={onSubmit}>
        <div className="form-grid">
          <label>
            Nombre
            <input
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </label>
          <label>
            Apellido
            <input
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </label>
          <label>
            Teléfono
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
        </div>
        <p className="form-help">
          El correo y los pedidos históricos no se modifican desde esta pantalla.
        </p>
        <div className="modal-actions">
          <button className="admin-button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="admin-button primary" disabled={busy} type="submit">
            Guardar cambios
          </button>
        </div>
      </form>
    </Modal>
  );
}
function CategoryModal({
  form,
  setForm,
  onSubmit,
  onClose,
  busy,
}: {
  form: { id: string; name: string; slug: string; imageUrl: string; imageFile: File | null };
  setForm: (form: { id: string; name: string; slug: string; imageUrl: string; imageFile: File | null }) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  busy: boolean;
}) {
  return (
    <Modal title={form.id ? "Editar categoría" : "Nueva categoría"} onClose={onClose}>
      <form className="admin-form" onSubmit={onSubmit}>
        <label>
          Nombre
          <input
            required
            maxLength={100}
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
                slug: form.id ? form.slug : slugify(e.target.value),
              })
            }
          />
        </label>
        <label>
          Slug
          <input
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
          />
        </label>
        <label>
          Imagen de la categoría
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setForm({ ...form, imageFile: event.target.files?.[0] ?? null })} />
          <span className="form-help">JPG, PNG o WebP. Se almacena en Cloudflare R2.</span>
          {form.imageUrl && <><Image
                  className="admin-form-image-preview"
                  src={adminImageSrc(form.imageUrl)}
                  alt="Imagen actual de la categoría"
                  width={640}
                  height={360}
                  sizes="(max-width: 760px) 100vw, 240px"
                /><button className="table-action danger" type="button" onClick={() => setForm({ ...form, imageUrl: "", imageFile: null })}>Quitar imagen</button></>}
        </label>
        <div className="modal-actions">
          <button className="admin-button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="admin-button primary" disabled={busy} type="submit">
            Guardar categoría
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ServiceTypeModal({
  form,
  setForm,
  onSubmit,
  onClose,
}: {
  form: ServiceTypeForm;
  setForm: (form: ServiceTypeForm) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}) {
  const set = (key: keyof ServiceTypeForm, value: string | boolean) =>
    setForm({ ...form, [key]: value });
  return (
    <Modal
      title={form.code ? "Editar servicio ofrecido" : "Nuevo servicio ofrecido"}
      onClose={onClose}
    >
      <form className="admin-form" onSubmit={onSubmit}>
        <div className="form-grid">
          <label>
            Código
            <input
              required
              maxLength={64}
              pattern="[A-Za-z][A-Za-z0-9_]{2,63}"
              disabled={Boolean(form.code && form.name)}
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
            />
          </label>
          <label>
            Slug
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={form.slug}
              onChange={(e) => set("slug", slugify(e.target.value))}
            />
          </label>
          <label>
            Nombre
            <input
              required
              maxLength={180}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <label>
            Categoría
            <select value={form.category} onChange={(e) => set("category", e.target.value)}>
              <option>DEVICE</option>
              <option>NETWORK</option>
              <option>SOFTWARE</option>
              <option>REPAIR</option>
              <option>OTHER</option>
            </select>
          </label>
        </div>
        <label>
          Descripción
          <textarea
            required
            maxLength={5000}
            rows={4}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </label>
        <label>
          Imagen del servicio
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setForm({ ...form, imageFile: event.target.files?.[0] ?? null })} />
          <span className="form-help">JPG, PNG o WebP. Se almacena en Cloudflare R2.</span>
          {form.imageUrl && <><Image
                  className="admin-form-image-preview"
                  src={adminImageSrc(form.imageUrl)}
                  alt="Imagen actual del servicio"
                  width={640}
                  height={360}
                  sizes="(max-width: 760px) 100vw, 240px"
                /><button className="table-action danger" type="button" onClick={() => setForm({ ...form, imageUrl: "", imageFile: null })}>Quitar imagen</button></>}
        </label>
        <div className="form-grid">
          <label>Precio desde (centavos COP)<input type="number" min="0" value={form.priceFromInCents} onChange={(e) => set("priceFromInCents", e.target.value)} /></label>
          <label>Precio fijo (centavos COP)<input type="number" min="0" value={form.fixedPriceInCents} onChange={(e) => set("fixedPriceInCents", e.target.value)} /></label>
          <label>Tiempo estimado (minutos)<input type="number" min="1" value={form.estimatedMinutes} onChange={(e) => set("estimatedMinutes", e.target.value)} /></label>
          <label>Garantía (días)<input type="number" min="0" value={form.warrantyDays} onChange={(e) => set("warrantyDays", e.target.value)} /></label>
        </div>
        <div className="form-grid">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.quoteRequired}
              onChange={(e) => set("quoteRequired", e.target.checked)}
            />{" "}
            Requiere cotización
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.paymentRequired}
              onChange={(e) => set("paymentRequired", e.target.checked)}
            />{" "}
            Requiere pago
          </label>
          <label className="checkbox-label"><input type="checkbox" checked={form.requiresDiagnosis} onChange={(e) => set("requiresDiagnosis", e.target.checked)} /> Requiere diagnóstico</label>
          <label className="checkbox-label"><input type="checkbox" checked={form.requiresApproval} onChange={(e) => set("requiresApproval", e.target.checked)} /> Requiere aprobación del cliente</label>
        </div>
        <label>Compatibilidad (una por línea: Marca|Modelo)<textarea rows={4} value={form.compatibilityText} onChange={(e) => set("compatibilityText", e.target.value)} placeholder="Apple|iPhone 15 Pro&#10;Samsung|Galaxy S24" /></label>
        <label>Requisitos de recepción (uno por línea)<textarea rows={4} value={form.requirementsText} onChange={(e) => set("requirementsText", e.target.value)} placeholder="Copia de documento del propietario&#10;Equipo desbloqueado" /></label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => set("enabled", e.target.checked)}
          />{" "}
          Visible para clientes
        </label>
        <div className="modal-actions">
          <button className="admin-button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="admin-button primary" type="submit">
            Guardar servicio
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ServiceActionModal({
  actionValue,
  onClose,
  onSubmit,
}: {
  actionValue: string;
  onClose: () => void;
  onSubmit: (id: string, action: string, body?: Record<string, unknown>) => void;
}) {
  const parts = actionValue.split(":");
  const id = parts[0] ?? "";
  const action = parts[1] ?? "";
  const status = parts.slice(2).join(":");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const transition = action === "transition";
  const quote = action === "quote";
  return (
    <Modal
      title={transition ? "Actualizar servicio" : quote ? "Cotizar servicio" : "Acción de servicio"}
      onClose={onClose}
    >
      <form
        className="admin-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (transition) onSubmit(id, "transition", { status });
          else if (quote) onSubmit(id, "quote", { amountInCents: Number(amount) });
          else onSubmit(id, action, { notes });
        }}
      >
        <label>
          {transition
            ? "Estado nuevo"
            : quote
              ? "Valor de cotización en COP"
              : "Notas de finalización"}
          {transition ? (
            <input value={status.replaceAll("_", " ")} readOnly />
          ) : quote ? (
            <input
              required
              min="0"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          ) : (
            <textarea required rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          )}
        </label>
        <div className="modal-actions">
          <button className="admin-button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="admin-button primary" type="submit">
            Aplicar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HomeCarouselManager({
  slides,
  onEdit,
  onView,
  onToggle,
  loading,
}: {
  slides: HomeSlide[];
  onEdit: (slide: HomeSlideForm) => void;
  onView: (slide: HomeSlide) => void;
  onToggle: (id: string) => void;

  loading: boolean;}) {
  return (
    <TableFrame empty={!slides.length} loading={loading} label="Cargando promociones…">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Promoción</th>
            <th>Enlace</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {slides.map((slide) => (
            <tr key={slide.id}>
              <td>
                <strong>{slide.title}</strong>
                <span className="table-subtext">{slide.eyebrow}</span>
              </td>
              <td>{slide.href}</td>
              <td>
                <span className={`status ${slide.active ? "success" : "muted-status"}`}>
                  {slide.active ? "Publicado" : "Oculto"}
                </span>
              </td>
              <td>
                <button className="table-action" type="button" onClick={() => onView(slide)}>
                  Ver
                </button>
                <button className="table-action" type="button" onClick={() => onEdit(slide)}>
                  Editar
                </button>
                <button className="table-action" type="button" onClick={() => onToggle(slide.id)}>
                  {slide.active ? "Ocultar" : "Publicar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

function HomeSlidePreviewModal({ slide, onClose }: { slide: HomeSlide; onClose: () => void }) {
  return (
    <Modal title="Vista previa de promoción" onClose={onClose}>
      <article className="home-slide-preview">
        <Image
          src={adminImageSrc(slide.imageUrl)}
          alt={slide.title}
          width={1280}
          height={720}
          sizes="(max-width: 760px) 100vw, 620px"
          unoptimized={slide.imageUrl.startsWith("blob:")}
        />
        <div>
          <p className="eyebrow">{slide.eyebrow}</p>
          <h3>{slide.title}</h3>
          <p>{slide.description}</p>
          <strong>Enlace: {slide.href}</strong>
          <span className={`status ${slide.active ? "success" : "muted-status"}`}>
            {slide.active ? "Publicado" : "Oculto"}
          </span>
        </div>
      </article>
    </Modal>
  );
}

function HomeSlideModal({
  form,
  setForm,
  cmsId,
  slides,
  onSaved,
  onClose,
}: {
  form: HomeSlideForm;
  setForm: (form: HomeSlideForm) => void;
  cmsId: string;
  slides: HomeSlide[];
  onSaved: (slides: HomeSlide[], cmsId: string) => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  useEffect(
    () => () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      let imageUrl = form.imageUrl;
      if (file) {
        const upload = new FormData();
        upload.set("file", file);
        const uploadResponse = await fetch("/api/admin/media?scope=home", {
          method: "POST",
          body: upload,
          credentials: "same-origin",
          cache: "no-store",
        });
        const uploadData = await json<{ url?: string; error?: string }>(uploadResponse);
        if (!uploadResponse.ok || !uploadData.url)
          throw new Error(uploadData.error ?? "No se pudo cargar la imagen.");
        imageUrl = uploadData.url;
      }
      if (!imageUrl) throw new Error("Selecciona una imagen para la promoción.");
      const next = { ...form, imageUrl };
      const nextSlides = slides.some((slide) => slide.id === form.id)
        ? slides.map((slide) => (slide.id === form.id ? next : slide))
        : [...slides, next];
      const response = await fetch("/api/admin/cms", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cmsId || undefined,
          slug: "home-carousel",
          title: "Carrusel de inicio",
          content: JSON.stringify({ slides: nextSlides }),
          active: true,
        }),
      });
      const data = await json<{ id?: string; error?: string }>(response);
      if (!response.ok || !data.id)
        throw new Error(data.error ?? "No se pudo guardar la promoción.");
      onSaved(nextSlides, data.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la promoción.");
    } finally {
      setBusy(false);
    }
  }
  const preview = previewUrl || form.imageUrl;
  return (
    <>
      <Modal
        title={
          form.id && slides.some((slide) => slide.id === form.id)
            ? "Editar promoción"
            : "Nueva promoción"
        }
        onClose={onClose}
      >
        <form className="admin-form" onSubmit={submit}>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-grid">
            <label>
              Etiqueta
              <input
                required
                maxLength={80}
                value={form.eyebrow}
                onChange={(e) => setForm({ ...form, eyebrow: e.target.value })}
              />
            </label>
            <label>
              Enlace
              <input
                required
                maxLength={300}
                value={form.href}
                onChange={(e) => setForm({ ...form, href: e.target.value })}
              />
            </label>
          </div>
          <label>
            Título
            <input
              required
              maxLength={180}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Descripción
            <textarea
              required
              maxLength={500}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label>
            Imagen de la promoción
            <input
              type="url"
              placeholder="https://drive.google.com/..."
              value={file ? "" : form.imageUrl}
              onChange={(e) => {
                setFile(null);
                setForm({ ...form, imageUrl: e.target.value });
              }}
            />
            <span className="form-help">
              Puedes subir un archivo o usar una URL pública de Google Drive.
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {form.imageUrl && (
              <span className="form-help">
                Imagen actual cargada. Selecciona otra para reemplazarla.
              </span>
            )}
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />{" "}
            Publicada en el inicio
          </label>
          <div className="modal-actions">
            <button
              className="admin-button"
              type="button"
              disabled={!preview}
              onClick={() => setPreviewUrl(file ? URL.createObjectURL(file) : form.imageUrl)}
            >
              Vista previa
            </button>
            <button className="admin-button" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="admin-button primary" disabled={busy} type="submit">
              {busy ? "Guardando…" : "Guardar promoción"}
            </button>
          </div>
        </form>
      </Modal>
      {previewUrl && (
        <HomeSlidePreviewModal
          slide={{ ...form, imageUrl: previewUrl }}
          onClose={() => setPreviewUrl("")}
        />
      )}
    </>
  );
}
