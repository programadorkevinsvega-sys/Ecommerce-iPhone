export async function verifyPayPalWebhook(input: Readonly<{ body: string; webhookId: string; authAlgo: string | null; certUrl: string | null; transmissionId: string | null; transmissionSig: string | null; transmissionTime: string | null }>, accessToken: string): Promise<void> {
  if (!accessToken || !input.webhookId || !input.authAlgo || !input.certUrl || !input.transmissionId || !input.transmissionSig || !input.transmissionTime) throw new Error("PayPal webhook verification data is missing");
  const response = await fetch("https://api-m.paypal.com/v1/notifications/verify-webhook-signature", {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ auth_algo: input.authAlgo, cert_url: input.certUrl, transmission_id: input.transmissionId, transmission_sig: input.transmissionSig, transmission_time: input.transmissionTime, webhook_id: input.webhookId, webhook_event: JSON.parse(input.body) }),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== "object" || (result as Record<string, unknown>).verification_status !== "SUCCESS") throw new Error("Invalid PayPal webhook signature");
}
