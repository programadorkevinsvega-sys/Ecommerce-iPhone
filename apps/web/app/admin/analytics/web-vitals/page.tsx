"use client";

import { useEffect, useState } from "react";
import AdminPageShell from "../../AdminPageShell";
import AdminPanel from "../../AdminPanel";
import AdminSectionHeading from "../../AdminSectionHeading";

type P75Row = Readonly<{
  metric: "LCP" | "INP" | "CLS";
  route: string;
  environment: string;
  p75: number;
  sample_count: number;
}>;
type DistributionRow = Readonly<{
  metric: "LCP" | "INP" | "CLS";
  route: string;
  environment: string;
  rating: "good" | "needs-improvement" | "poor";
  sample_count: number;
}>;
type Report = Readonly<{
  periodDays: number;
  p75: P75Row[];
  ratingDistribution: DistributionRow[];
}>;

function formatP75(metric: P75Row["metric"], value: number): string {
  if (metric === "CLS") return value.toFixed(3);
  return `${Math.round(value).toLocaleString("es-CO")} ms`;
}

const ratingLabels: Record<DistributionRow["rating"], string> = {
  good: "Buena",
  "needs-improvement": "Necesita mejora",
  poor: "Deficiente",
};

export default function WebVitalsPage() {
  const [days, setDays] = useState("28");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void fetch(`/api/admin/analytics/web-vitals?days=${days}`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        const data = (await response.json()) as Report & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "No se pudo consultar Web Vitals.");
        if (active) setReport(data);
      })
      .catch((caught: unknown) => {
        if (active)
          setError(caught instanceof Error ? caught.message : "No se pudo consultar Web Vitals.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [days]);

  return (
    <AdminPageShell
      active="performance"
      kicker="Observabilidad"
      title="Core Web Vitals"
      description="Percentiles de campo recibidos desde navegadores reales. Las mediciones Lighthouse de CI se consultan por separado en los artefactos del workflow."
    >
      <section className="admin-workspace admin-page-grid">
        <AdminPanel>
          <AdminSectionHeading kicker="Período de análisis" title="Muestras de campo" />
          <label htmlFor="web-vitals-period">Ventana de datos</label>
          <select
            id="web-vitals-period"
            value={days}
            onChange={(event) => setDays(event.target.value)}
          >
            <option value="7">Últimos 7 días</option>
            <option value="28">Últimos 28 días</option>
            <option value="90">Últimos 90 días</option>
          </select>
          <p role="status">
            {loading
              ? "Cargando mediciones…"
              : report
                ? `Ventana: ${report.periodDays} días`
                : "Sin datos disponibles."}
          </p>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
        </AdminPanel>

        <AdminPanel>
          <AdminSectionHeading kicker="Distribución" title="Percentil 75 (p75)" />
          {!loading && report?.p75.length === 0 && (
            <p>
              No hay muestras RUM para el período seleccionado. Los datos aparecerán después de
              desplegar la migración y recibir visitas muestreadas.
            </p>
          )}
          {report && report.p75.length > 0 && (
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Métrica</th>
                    <th scope="col">Ruta</th>
                    <th scope="col">Entorno</th>
                    <th scope="col">p75</th>
                    <th scope="col">Muestras</th>
                  </tr>
                </thead>
                <tbody>
                  {report.p75.map((row) => (
                    <tr key={`${row.metric}:${row.route}:${row.environment}`}>
                      <td>
                        <strong>{row.metric}</strong>
                      </td>
                      <td>{row.route}</td>
                      <td>{row.environment}</td>
                      <td>{formatP75(row.metric, row.p75)}</td>
                      <td>{row.sample_count.toLocaleString("es-CO")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminPanel>

        <AdminPanel>
          <AdminSectionHeading kicker="Calidad" title="Distribución por rating" />
          {!loading && report?.ratingDistribution.length === 0 && (
            <p>No hay ratings registrados para este período.</p>
          )}
          {report && report.ratingDistribution.length > 0 && (
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Métrica</th>
                    <th scope="col">Ruta</th>
                    <th scope="col">Entorno</th>
                    <th scope="col">Rating</th>
                    <th scope="col">Muestras</th>
                  </tr>
                </thead>
                <tbody>
                  {report.ratingDistribution.map((row) => (
                    <tr key={`${row.metric}:${row.route}:${row.environment}:${row.rating}`}>
                      <td>
                        <strong>{row.metric}</strong>
                      </td>
                      <td>{row.route}</td>
                      <td>{row.environment}</td>
                      <td>{ratingLabels[row.rating]}</td>
                      <td>{row.sample_count.toLocaleString("es-CO")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p>
            LCP e INP se muestran en milisegundos; CLS no tiene unidad. Revisa el tamaño de muestra
            antes de comparar grupos o sacar conclusiones.
          </p>
        </AdminPanel>
      </section>
    </AdminPageShell>
  );
}
