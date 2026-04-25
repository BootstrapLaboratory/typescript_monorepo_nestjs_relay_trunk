import type { RushCachePolicy, RushCacheProvider } from "../model/rush-cache.ts";

export function parseRushCacheProvider(value: string): RushCacheProvider {
  switch (value) {
    case "off":
    case "github":
      return value;
    default:
      throw new Error(`Unsupported Rush cache provider "${value}".`);
  }
}

export function parseRushCachePolicy(value: string): RushCachePolicy {
  switch (value) {
    case "lazy":
      return value;
    default:
      throw new Error(`Unsupported Rush cache policy "${value}".`);
  }
}
