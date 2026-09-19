// A single instance of this Durable Object sees every request in order, so
// the count is exact even when requests arrive at the same time.
import { DurableObject } from "cloudflare:workers";
import { consume, type ConsumeResult, type Limits, type UsageState } from "./usage";

export class UsageCap extends DurableObject {
  async tryConsume(limits: Limits): Promise<ConsumeResult> {
    const prev = await this.ctx.storage.get<UsageState>("usage");
    const result = consume(prev, new Date(), limits);
    if (result.ok) await this.ctx.storage.put("usage", result.state);
    return result;
  }
}
