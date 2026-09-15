import type { D1Database } from "@cloudflare/workers-types";
import type { CustomerSecurityAuditRepository, CustomerSecurityEvent } from "../application/CustomerSecurityAuditRepository";

export class D1CustomerSecurityAuditRepository implements CustomerSecurityAuditRepository {
  constructor(private readonly db: D1Database) {}

  async record(event: CustomerSecurityEvent): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO customer_security_events(id,customer_id,event_type,source_ip,user_agent,metadata_json) VALUES(?,?,?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        event.customerId,
        event.eventType,
        event.sourceIp,
        event.userAgent,
        event.metadata ? JSON.stringify(event.metadata) : null,
      )
      .run();
  }
}
