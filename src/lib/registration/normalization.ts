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
    goals: z
      .string()
      .trim()
      .max(500, "Goals must be 500 characters or fewer.")
      .refine((value) => !/<[^>]*>/u.test(value), "Goals must be plain text.")
      .optional()
      .or(z.literal("")),
    referralSource: z.enum(referralSourceValues).optional().or(z.literal("")),
    referralSourceOther: z.string().trim().max(200).optional(),
    eventIds: z.array(z.string().uuid()).min(1, "Select at least one date.").max(50),
    legalPackageAcknowledged: z.literal("on", {
      errorMap: () => ({ message: "Accept the Eoke LLC Participation Liability Waiver." }),
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

export function canonicalizeName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function canonicalizeContactText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
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
