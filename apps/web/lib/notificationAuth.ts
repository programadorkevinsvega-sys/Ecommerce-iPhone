import { cookies } from "next/headers";
import { currentAdmin, PERMISSIONS } from "./adminAuth";
import { currentCustomerId } from "./customerSession";
import { currentTechnician } from "./technicianAuth";
import type { NotificationRecipient, NotificationRecipientType } from "../../modules/notifications/domain/NotificationEvent";

export type NotificationScope = NotificationRecipientType;

function validScope(value: string | null): NotificationScope | null {
  return value === "customer" || value === "technician" || value === "admin" ? value : null;
}

export async function requireNotificationRecipient(scopeValue: string | null): Promise<NotificationRecipient> {
  const scope = validScope(scopeValue);
  if (!scope) throw new Error("INVALID_SCOPE");

  if (scope === "customer") {
    const id = await currentCustomerId();
    if (!id) throw new Error("UNAUTHORIZED");
    return { type: "customer", id };
  }

  if (scope === "technician") {
    const technician = await currentTechnician();
    if (!technician) throw new Error("UNAUTHORIZED");
    return { type: "technician", id: technician.id };
  }

  const admin = await currentAdmin();
  if (!admin) throw new Error("UNAUTHORIZED");
  if (!admin.permissions.includes(PERMISSIONS.dashboardRead)) throw new Error("FORBIDDEN");
  return { type: "admin", id: admin.id };
}

export async function notificationCookieScope(): Promise<NotificationScope | null> {
  const store = await cookies();
  if (store.get("admin_session")?.value) return "admin";
  if (store.get("technician_session")?.value) return "technician";
  if (store.get("customer_session")?.value) return "customer";
  return null;
}
