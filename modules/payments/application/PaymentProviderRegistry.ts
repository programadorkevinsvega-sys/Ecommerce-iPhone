import type { PaymentProvider } from "../domain/Payment";
import type { PaymentProviderPort } from "./PaymentPorts";

export class PaymentProviderRegistry {
  private readonly providers: ReadonlyMap<PaymentProvider, PaymentProviderPort>;

  constructor(providers: readonly PaymentProviderPort[]) {
    const map = new Map<PaymentProvider, PaymentProviderPort>();
    for (const provider of providers) {
      if (map.has(provider.provider)) throw new Error(`Duplicate payment provider registration: ${provider.provider}`);
      map.set(provider.provider, provider);
    }
    if (map.size === 0) throw new Error("At least one payment provider must be registered");
    this.providers = map;
  }

  resolve(provider: PaymentProvider): PaymentProviderPort {
    const resolved = this.providers.get(provider);
    if (!resolved) throw new Error(`Payment provider is not enabled: ${provider}`);
    return resolved;
  }

  available(): readonly PaymentProvider[] {
    return [...this.providers.keys()];
  }
}
