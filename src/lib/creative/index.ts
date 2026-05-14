/**
 * Creative provider factory.
 *
 * Selects the appropriate provider based on configuration:
 * - If MELIUS_API_KEY is set → MeliusProvider (full canvas + generation)
 * - Otherwise → LocalProvider (no external dependency)
 *
 * This abstraction prevents vendor lock-in. The pipeline calls
 * provider methods without knowing which backend is active.
 */

export type { CreativeProvider, CreativeSession, GeneratedAsset } from "./types";

import type { CreativeProvider } from "./types";
import { MeliusProvider } from "./melius-provider";
import { LocalProvider } from "./local-provider";

let _provider: CreativeProvider | null = null;

/**
 * Get the active creative provider.
 * Lazily instantiated, cached for the process lifetime.
 */
export function getCreativeProvider(): CreativeProvider {
  if (_provider) return _provider;

  if (process.env.MELIUS_API_KEY) {
    _provider = new MeliusProvider();
    console.log("[creative] Using Melius provider");
  } else {
    _provider = new LocalProvider();
    console.log("[creative] Using local provider (no MELIUS_API_KEY)");
  }

  return _provider;
}

/**
 * Force a specific provider (useful for testing).
 */
export function setCreativeProvider(provider: CreativeProvider): void {
  _provider = provider;
}
