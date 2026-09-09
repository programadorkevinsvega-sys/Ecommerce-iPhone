import type { EmailProvider } from "../application/NotificationPorts";

export class ResendEmailProvider implements EmailProvider {
  constructor(private readonly apiKey: string, private readonly from: string) {}
  async send(input: Parameters<EmailProvider["send"]>[0]): Promise<{ id: string }> {
    if (!this.apiKey) throw new Error("RESEND_API_KEY is not configured");
    if (!this.from) throw new Error("EMAIL_FROM is not configured");
    const response = await fetch("https://api.resend.com/emails", { method:"POST", headers:{"Authorization":`Bearer ${this.apiKey}`,"Content-Type":"application/json"}, body:JSON.stringify({from:this.from,to:[input.to],subject:input.subject,html:input.html,text:input.text,tags:Object.entries(input.tags ?? {}).map(([name,value])=>({name,value}))}) });
    if (!response.ok) throw new Error(`Resend error ${response.status}: ${(await response.text()).slice(0,500)}`);
    const data = await response.json() as { id?: string };
    if (!data.id) throw new Error("Resend response did not include an email id");
    return { id:data.id };
  }
}
