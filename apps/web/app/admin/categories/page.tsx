import { Suspense } from "react";
import { AdminPageContent } from "../page";

export default function AdminRoutePage() {
  return (
    <Suspense
      fallback={
        <main className="admin-loading">
          <span className="admin-spinner" /> Cargando panel…
        </main>
      }
    >
      <AdminPageContent fixedResource="categories" />
    </Suspense>
  );
}
