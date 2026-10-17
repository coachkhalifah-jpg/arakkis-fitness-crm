import { createHash, randomBytes } from "node:crypto";

/** SHA-256 digest as PostgreSQL/PostgREST hex bytea (`\x` + 64 lowercase hex). */
export function hashInvitationToken(token: string) {
  return `\\x${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

export function createInvitationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}
