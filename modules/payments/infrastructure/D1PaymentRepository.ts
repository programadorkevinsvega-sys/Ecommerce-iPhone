import type { D1Database } from "@cloudflare/workers-types";
import type { PaymentRepository } from "../application/PaymentPorts";
import type { Payment, PaymentProvider, PaymentStatus } from "../domain/Payment";

export class D1PaymentRepository implements PaymentRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<Payment | null> {
    const row = await this.db.prepare("SELECT * FROM payments WHERE id=?").bind(id).first<PaymentRow>();
    return row ? this.map(row) : null;
  }

  async findByIdempotencyKey(customerId: string, key: string): Promise<Payment | null> {
    const row = await this.db.prepare("SELECT * FROM payments WHERE customer_id=? AND idempotency_key=? LIMIT 1").bind(customerId, key).first<PaymentRow>();
    return row ? this.map(row) : null;
  }

  async findByProviderReference(reference: string): Promise<Payment | null> {
    const row = await this.db.prepare("SELECT * FROM payments WHERE provider_reference=? LIMIT 1").bind(reference).first<PaymentRow>();
    return row ? this.map(row) : null;
  }

  async findByProviderTransactionId(transactionId: string): Promise<Payment | null> {
    const row = await this.db.prepare("SELECT * FROM payments WHERE provider_transaction_id=? LIMIT 1").bind(transactionId).first<PaymentRow>();
    return row ? this.map(row) : null;
  }

  async create(payment: Payment): Promise<void> {
    await this.db.prepare(
      "INSERT INTO payments(id,order_id,customer_id,provider,provider_reference,status,amount_in_cents,currency,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    ).bind(
      payment.id, payment.orderId, payment.customerId, payment.provider, payment.providerReference, payment.status,
      payment.amountInCents, payment.currency, payment.idempotencyKey, payment.createdAt, payment.updatedAt,
    ).run();
  }

  async attachProviderTransaction(id: string, transactionId: string): Promise<boolean> {
    const result = await this.db.prepare("UPDATE payments SET provider_transaction_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND (provider_transaction_id IS NULL OR provider_transaction_id=?)").bind(transactionId, id, transactionId).run();
    return result.meta.changes === 1;
  }

  async transition(id: string, from: PaymentStatus, to: PaymentStatus): Promise<boolean> {
    const result = await this.db.prepare("UPDATE payments SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?").bind(to, id, from).run();
    return result.meta.changes === 1;
  }

  async recordWebhook(provider: PaymentProvider, eventId: string, payload: string): Promise<boolean> {
    const result = await this.db.prepare("INSERT OR IGNORE INTO payment_webhook_events(id,provider,event_id,payload_json,received_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)").bind(crypto.randomUUID(), provider, eventId, payload).run();
    return result.meta.changes === 1;
  }

  async recordLedger(paymentId: string, entryType: string, amountInCents: number, currency: string, metadata: string): Promise<void> {
    await this.db.prepare("INSERT OR IGNORE INTO payment_ledger(id,payment_id,entry_type,amount_in_cents,currency,metadata_json,created_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)").bind(
      crypto.randomUUID(), paymentId, entryType, amountInCents, currency, metadata,
    ).run();
  }

  private map(row: PaymentRow): Payment {
    return {
      id: row.id,
      orderId: row.order_id,
      customerId: row.customer_id,
      provider: row.provider,
      providerReference: row.provider_reference,
      ...(row.provider_transaction_id ? { providerTransactionId: row.provider_transaction_id } : {}),
      status: row.status,
      amountInCents: row.amount_in_cents,
      currency: row.currency,
      idempotencyKey: row.idempotency_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

type PaymentRow = {
  id: string;
  order_id: string;
  customer_id: string;
  provider: Payment["provider"];
  provider_reference: string;
  provider_transaction_id: string | null;
  status: PaymentStatus;
  amount_in_cents: number;
  currency: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
};
