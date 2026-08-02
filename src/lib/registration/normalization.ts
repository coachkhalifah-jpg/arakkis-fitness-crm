import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { z } from "zod";
import { referralSourceValues } from "@/lib/registration/referral";

export const participantInputSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name.").max(100),
    lastName: z.string().trim().min(1, "Enter your last name.").max(100),
    phone: z.string().trim().min(3, "Enter a mobile phone number.").max(40),
    phoneCountry: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2,3}$/, "Choose a phone country."),
    email: z.string().trim().max(254).optional().or(z.literal("")),
    fitnessExperience: z.string().trim().max(1000).optional(),
    referralSource: z.enum(referralSourceValues).optional().or(z.literal("")),
    referralSourceOther: z.string().trim().max(200).optional(),
    eventIds: z.array(z.string().uuid()).min(1, "Select at least one date.").max(50),
    participationAcknowledged: z.literal("on", {
      errorMap: () => ({ message: "Accept the participation acknowledgment." }),
    }),
    dataUseAcknowledged: z.literal("on", {
      errorMap: () => ({ message: "Accept the data-use acknowledgment." }),
    }),
  })
  .superRefine((value, context) => {
    if (value.referralSource !== "OTHER" && value.referralSourceOther?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referralSourceOther"],
        message: "Referral detail can only be used with Other.",
      });
    }
  });

export function normalizeName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

export function normalizeEmail(value: string) {
  const email = value.trim().toLocaleLowerCase();
  if (!email) return null;
  return z.string().email().max(254).parse(email);
}

export function normalizePhone(value: string, country: string) {
  const parsed = parsePhoneNumberFromString(value, country.toUpperCase() as never);
  if (!parsed || !parsed.isValid())
    throw new Error("Enter a valid phone number for the selected country.");
  return { e164: parsed.number, country: parsed.country ?? country.toUpperCase() };
}
