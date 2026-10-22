// The local edition has no account or onboarding prerequisite for recording.
export async function initializeLocalRenderer({ storage, api, isControlPanel }) {
  storage.setItem("onboardingCompleted", "true");
  storage.setItem("authenticationSkipped", "true");
  storage.setItem("skipAuth", "true");
  await api?.setOnboardingActive?.(false);
  if (isControlPanel) await api?.setOnboardingWindowMode?.("restore");
  api?.markMacAccessibilityFeaturesReady?.();
}
