/**
 * Onboarding tour — shared state between the modal and the "Show tips" action
 * in the account menu.
 *
 * The storage key lives here so the two can never drift apart. (They did
 * once: the modal wrote `..._v2` while the menu cleared `...`, so "Show tips"
 * never brought the tour back.)
 */

export const ONBOARDING_STORAGE_KEY = "nuncio_onboarding_done_v2";

/** Fired to (re)open the tour from anywhere in the app. */
export const ONBOARDING_OPEN_EVENT = "nuncio:open-onboarding";

export function markOnboardingDone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch {
    /* private mode / storage disabled — the tour just shows again */
  }
}

export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function resetOnboarding(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Ask any mounted OnboardingModal to open now. */
export function requestOnboardingTour(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ONBOARDING_OPEN_EVENT));
}
