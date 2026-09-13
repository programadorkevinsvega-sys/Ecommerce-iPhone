"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Category = { id: string; name: string; slug: string; active: boolean };
type CategoriesResponse = { items?: Category[]; error?: string };
type AssignmentResponse = { categoryIds?: string[]; error?: string };
type Product = { id: string; name: string; slug: string; brand: string; model: string; active: number; error?: string };
type ProductsResponse = { items?: Product[]; error?: string };

export default function ProductCategoriesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const productId = params.id;
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const activeCategories = useMemo(() => categories.filter((category) => category.active), [categories]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [categoriesResponse, assignmentResponse, productsResponse] = await Promise.all([
          fetch("/api/admin/categories", { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
          fetch(`/api/admin/products/${encodeURIComponent(productId)}/categories`, { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
          fetch(`/api/admin/resources?resource=products&q=${encodeURIComponent(productId)}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
        ]);
        if ([categoriesResponse, assignmentResponse, productsResponse].some((response) => response.status === 401 || response.status === 403)) {
          router.replace("/admin/login");
          return;
        }
        const categoriesData = (await categoriesResponse.json()) as CategoriesResponse;
        const assignmentData = (await assignmentResponse.json()) as AssignmentResponse;
        const productsData = (await productsResponse.json()) as ProductsResponse;
        if (!categoriesResponse.ok || !assignmentResponse.ok || !productsResponse.ok) throw new Error(categoriesData.error ?? assignmentData.error ?? productsData.error ?? "No se pudo cargar la información.");
        const foundProduct = (productsData.items ?? []).find((item) => String(item.id) === productId) ?? null;
        if (!foundProduct) throw new Error("Producto no encontrado.");
        setProduct(foundProduct);
        setCategories(categoriesData.items ?? []);
        setSelected(new Set(assignmentData.categoryIds ?? []));
        setError("");
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "No fue posible cargar las categorías del producto.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [productId, router]);

  function toggle(categoryId: string) {
    setSaved(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(productId)}/categories`, {
        method: "PATCH",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_ids: [...selected] }),
      });
      const data = (await response.json()) as AssignmentResponse;
      if (response.status === 401 || response.status === 403) {
        router.replace("/admin/login");
        return;
      }
      if (!response.ok) throw new Error(data.error ?? "No fue posible guardar las categorías.");
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar las categorías.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main style={{ maxWidth: 900, margin: "0 auto", padding: 32 }} aria-busy="true">Cargando categorías…</main>;
  if (!product) return <main style={{ maxWidth: 900, margin: "0 auto", padding: 32 }}><p role="alert">{error || "Producto no encontrado."}</p><button type="button" onClick={() => router.push("/admin")}>Volver al panel</button></main>;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 32, display: "grid", gap: 24 }}>
      <header>
        <button type="button" onClick={() => router.push("/admin")}>← Volver</button>
        <p style={{ marginTop: 24 }}>PRODUCTO · {product.brand}</p>
        <h1>{product.name}</h1>
        <p>{product.model} · {product.slug}</p>
      </header>
      <section style={{ display: "grid", gap: 12 }} aria-labelledby="category-heading">
        <div>
          <h2 id="category-heading">Categorías del producto</h2>
          <p>Selecciona las categorías activas que deben aparecer en el catálogo.</p>
        </div>
        {error && <p role="alert">{error}</p>}
        {activeCategories.length === 0 ? <p>No hay categorías activas disponibles.</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
            {activeCategories.map((category) => (
              <label key={category.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
                <input type="checkbox" checked={selected.has(category.id)} onChange={() => toggle(category.id)} />
                <span><strong>{category.name}</strong><small style={{ display: "block" }}>{category.slug}</small></span>
              </label>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
          <button type="button" disabled={saving} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar categorías"}</button>
          {saved && <span role="status">Guardado correctamente.</span>}
        </div>
      </section>
    </main>
  );
}
