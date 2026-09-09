import type { EmailTemplate } from "../domain/NotificationEvent";

export function renderEmail(template: EmailTemplate, payload: Record<string, unknown>): { subject: string; html: string; text: string } {
  const orderNumber = String(payload.orderNumber ?? payload.orderId ?? "");
  const status = String(payload.status ?? "");
  const serviceId = String(payload.serviceRequestId ?? payload.serviceId ?? "");
  const title = template === "ORDER_CREATED" ? "Pedido recibido" : template === "ORDER_PAID" ? "Pago confirmado" : template === "ORDER_STATUS_CHANGED" ? "Actualización de tu pedido" : template === "SERVICE_REQUESTED" ? "Solicitud de servicio recibida" : template === "SERVICE_STATUS_CHANGED" ? "Actualización de tu servicio" : "Notificación de administración";
  const subject = template === "ORDER_CREATED" ? `Pedido ${orderNumber} recibido` : template === "ORDER_PAID" ? `Pago confirmado — ${orderNumber}` : template === "ORDER_STATUS_CHANGED" ? `Pedido ${orderNumber}: ${status}` : template === "SERVICE_REQUESTED" ? `Solicitud de servicio ${serviceId} recibida` : template === "SERVICE_STATUS_CHANGED" ? `Servicio ${serviceId}: ${status}` : "Aviso de administración";
  const safe = (v: string) => v.replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]!));
  const body = template.startsWith("ORDER") ? `Tu pedido ${orderNumber} está en estado ${status || "recibido"}.` : template.startsWith("SERVICE") ? `Tu solicitud de servicio ${serviceId} está en estado ${status || "recibida"}.` : String(payload.message ?? "Tienes una nueva notificación.");
  return { subject, text: `${title}\n\n${body}`, html: `<main style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h1>${safe(title)}</h1><p>${safe(body)}</p></main>` };
}
