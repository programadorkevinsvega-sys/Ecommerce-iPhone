export type RequestFingerprint = Readonly<{ ipHash: string; userAgentHash: string }>;

export class CreateRequestFingerprint {
  constructor(private readonly hash: (value: string) => Promise<string>) {}

  async execute(ip: string, userAgent: string): Promise<RequestFingerprint> {
    return {
      ipHash: await this.hash(ip || "unknown"),
      userAgentHash: await this.hash(userAgent || "unknown"),
    };
  }
}
