import { createHash, randomBytes } from "node:crypto";

export function hashInvitationToken(token: string) {
  return `\\x${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

export function createInvitationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}
