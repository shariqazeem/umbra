import { describe, it, expect } from "vitest";
import { deriveNoteKey, encryptNoteOpening, decryptNoteOpening } from "@/lib/umbra/note-crypto";

// The encrypted note backup is what makes a private balance recover cross-device: a change
// note's opening is encrypted under a seed-derived key and posted on-chain. These pin the two
// properties that matter — a round-trip recovers the exact opening, and a ciphertext that isn't
// yours never decrypts (so scanning the whole pool only ever surfaces your own notes).
describe("note-crypto (encrypted note backup)", () => {
  const SECRET = 2n ** 250n + 987654321n; // a wide field-element-shaped secret
  const VALUE = 5_500_000_000n; // 550 XLM in stroops

  it("round-trips a note opening under the seed-derived key", async () => {
    const key = await deriveNoteKey(0xdead_beef_1234n);
    const ct = await encryptNoteOpening(key, SECRET, VALUE);
    const opening = await decryptNoteOpening(key, ct);
    expect(opening).not.toBeNull();
    expect(opening!.secret).toBe(SECRET);
    expect(opening!.value).toBe(VALUE);
  });

  it("same seed → same key → decrypts (cross-device determinism)", async () => {
    // Encrypt on 'device A', decrypt with a key freshly derived from the SAME seed on 'device B'.
    const ct = await encryptNoteOpening(await deriveNoteKey(42n), SECRET, VALUE);
    const opening = await decryptNoteOpening(await deriveNoteKey(42n), ct);
    expect(opening?.value).toBe(VALUE);
    expect(opening?.secret).toBe(SECRET);
  });

  it("returns null for a ciphertext encrypted under a different wallet's key", async () => {
    const ct = await encryptNoteOpening(await deriveNoteKey(1n), SECRET, VALUE);
    expect(await decryptNoteOpening(await deriveNoteKey(2n), ct)).toBeNull();
  });

  it("returns null (not throw) for empty / too-short blobs — the full-exit sentinel", async () => {
    const key = await deriveNoteKey(7n);
    expect(await decryptNoteOpening(key, new Uint8Array(0))).toBeNull();
    expect(await decryptNoteOpening(key, new Uint8Array(5))).toBeNull();
  });

  it("produces distinct ciphertexts for the same note (random IV) that both decrypt", async () => {
    const key = await deriveNoteKey(99n);
    const a = await encryptNoteOpening(key, SECRET, VALUE);
    const b = await encryptNoteOpening(key, SECRET, VALUE);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false); // IV randomization
    expect((await decryptNoteOpening(key, a))?.value).toBe(VALUE);
    expect((await decryptNoteOpening(key, b))?.value).toBe(VALUE);
  });
});
