import type { EmailProvider } from "../application/NotificationPorts";
import { NotificationProviderError } from "../application/NotificationProcessingError";

export class ResendEmailProvider implements EmailProvider {
  constructor(private readonly apiKey: string, private readonly from: string) {}

  async send(input: Parameters<EmailProvider["send"]>[0]): Promise<{ id: string }> {
    if (!this.apiKey) {
      throw new NotificationProviderError("RESEND_API_KEY is not configured", { retryable: false });
    }
    if (!this.from) {
      throw new NotificationProviderError("EMAIL_FROM is not configured", { retryable: false });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        tags: Object.entries(input.tags ?? {}).map(([name, value]) => ({ name, value })),
      }),
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      const retryable = response.status === 408 || response.status === 409 || response.status === 425 ||
        response.status === 429 || response.status >= 500;
      throw new NotificationProviderError(
        `Resend error ${response.status}: ${body}`,
        { retryable, status: response.status },
      );
    }

    const data = await response.json() as { id?: string };
    if (!data.id) {
      throw new NotificationProviderError("Resend response did not include an email id", { retryable: true });
    }
    return { id: data.id };
  }
}
