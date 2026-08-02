export const referralSourceOptions = [
  { value: "FRIEND_OR_FAMILY", label: "Friend or family" },
  { value: "WHATSAPP_OR_GROUP_CHAT", label: "WhatsApp or group chat" },
  { value: "INSTAGRAM_OR_SOCIAL_MEDIA", label: "Instagram or social media" },
  { value: "FLYER_OR_QR_CODE", label: "Flyer or QR code" },
  { value: "VENUE_ANNOUNCEMENT", label: "Venue announcement" },
  { value: "PREVIOUS_CLASS", label: "Previous class" },
  { value: "OTHER", label: "Other" },
] as const;

export const referralSourceValues = referralSourceOptions.map((option) => option.value) as [
  string,
  ...string[],
];
