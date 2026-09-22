/**
 * Admin Events feature flags.
 * All flags default to false unless the matching public env var is exactly "true".
 */
export const features = {
  adminEventsV2: process.env.NEXT_PUBLIC_FEATURE_ADMIN_EVENTS_V2 === "true",
  eventRecurrencePreview: process.env.NEXT_PUBLIC_FEATURE_RECURRENCE_PREVIEW === "true",
  eventPublishConfirmation: process.env.NEXT_PUBLIC_FEATURE_PUBLISH_CONFIRM === "true",
  eventDraftRecovery: process.env.NEXT_PUBLIC_FEATURE_DRAFT_RECOVERY === "true",
} as const;

export type FeatureFlag = keyof typeof features;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return features[flag];
}
