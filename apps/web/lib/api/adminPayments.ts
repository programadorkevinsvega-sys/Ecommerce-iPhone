import { paymentContext } from "../payments";
import { PERMISSIONS, requireAdmin } from "../adminAuth";

export async function listAdminPayments(searchParams: URLSearchParams) {
  const { env } = await requireAdmin(PERMISSIONS.ordersRead);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50) || 50, 1), 100);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0) || 0, 0);
  const status = searchParams.get("status")?.trim();
  const provider = searchParams.get("provider")?.trim();
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (status) { clauses.push("status = ?"); values.push(status); }
  if (provider) { clauses.push("provider = ?"); values.push(provider); }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const rows = await env.DB.prepare(`SELECT id,order_id,customer_id,provider,provider_reference,provider_transaction_id,status,amount_in_cents,currency,created_at,updated_at FROM payments${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...values, limit, offset).all();
  return { items: rows.results, limit, offset };
}

export async function getAdminPayment(id: string) {
  const { env } = await requireAdmin(PERMISSIONS.ordersRead);
  const payment = await env.DB.prepare("SELECT id,order_id,customer_id,provider,provider_reference,provider_transaction_id,checkout_url,status,amount_in_cents,currency,created_at,updated_at FROM payments WHERE id=? LIMIT 1").bind(id).first();
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");
  const refunds = await env.DB.prepare("SELECT id,provider_refund_id,status,amount_in_cents,currency,created_at,updated_at FROM payment_refunds WHERE payment_id=? ORDER BY created_at DESC").bind(id).all();
  const ledger = await env.DB.prepare("SELECT id,entry_type,amount_in_cents,currency,metadata_json,created_at FROM payment_ledger WHERE payment_id=? ORDER BY created_at DESC").bind(id).all();
  return { payment, refunds: refunds.results, ledger: ledger.results };
}

export async function refundAdminPayment(id: string, idempotencyKey: string) {
  const { admin, repo } = await requireAdmin(PERMISSIONS.refundsCreate);
  const key = idempotencyKey.trim();
  if (!key || key.length > 255) throw new Error("INVALID_IDEMPOTENCY_KEY");
  const context = await paymentContext();
  const result = await context.service.refundPayment(id, key);
  await repo.audit(admin.id, "ADMIN_PAYMENT_REFUND", "payment", id, { status: result.status, idempotencyKey: key });
  return result;
}

export async function voidAdminPayment(id: string, idempotencyKey: string) {
  const { admin, repo } = await requireAdmin(PERMISSIONS.paymentsVoid);
  const key = idempotencyKey.trim();
  if (!key || key.length > 255) throw new Error("INVALID_IDEMPOTENCY_KEY");
  const context = await paymentContext();
  const result = await context.service.voidPayment(id, key);
  await repo.audit(admin.id, "ADMIN_PAYMENT_VOID", "payment", id, { status: result.status, idempotencyKey: key });
  return result;
}
