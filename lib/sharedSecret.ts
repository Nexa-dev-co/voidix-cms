import { createHash } from "node:crypto";

/**
 * Length-independent comparison, so response timing can't be used to guess a secret one
 * character at a time.
 *
 * Hashing both sides first is what makes it length-independent: comparing the raw strings byte
 * by byte would return early on a short one and leak how much of it was right.
 *
 * Lives here rather than in `lib/leads/intake.ts` because the content read endpoint needs the
 * same comparison and is emphatically not a leads route — two callers with one implementation,
 * so a fix to it can never reach one and miss the other.
 */
export function isEqualInConstantTime(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();

  let difference = 0;
  for (let index = 0; index < leftHash.length; index += 1) {
    difference |= leftHash[index] ^ rightHash[index];
  }

  return difference === 0;
}
