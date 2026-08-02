export function participantDisplayName(value: string) {
  const withoutUuid = value.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    "",
  );
  const withoutFixtureSuffix = withoutUuid.replace(/\s+[0-9a-f]{6,}$/i, "");
  return withoutFixtureSuffix.replace(/\s{2,}/g, " ").trim() || value;
}
