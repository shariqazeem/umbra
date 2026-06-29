// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  decodePaymentLink,
  encodePaymentLink,
  type PaymentLinkPayload,
} from "../../packages/sdk/src/payment-link";

const COMMITMENT = "12876543210987654321";
const AMOUNT = "100";

function makePayload(over: Partial<PaymentLinkPayload> = {}): PaymentLinkPayload {
  return {
    v: 1,
    title: "Invoice",
    description: "Design work",
    recipientName: "Alex",
    amount: AMOUNT,
    commitment: COMMITMENT,
    proof: {
      proof: { pi_a: ["1", "2"], pi_b: [["1", "2"], ["3", "4"]], pi_c: ["5", "6"] },
      publicSignals: [COMMITMENT, AMOUNT], // [commitment, amount]
    },
    ...over,
  };
}

describe("payment-link integrity", () => {
  it("round-trips a valid link", () => {
    const p = decodePaymentLink(encodePaymentLink(makePayload()));
    expect(p.amount).toBe(AMOUNT);
    expect(p.commitment).toBe(COMMITMENT);
  });

  it("rejects a link whose displayed amount was tampered", () => {
    // Attacker keeps the same (unforgeable) proof but bumps the shown amount.
    const id = encodePaymentLink(makePayload({ amount: "999999" }));
    expect(() => decodePaymentLink(id)).toThrow(/amount mismatch/i);
  });

  it("rejects a link whose displayed commitment was tampered", () => {
    const id = encodePaymentLink(makePayload({ commitment: "999" }));
    expect(() => decodePaymentLink(id)).toThrow(/commitment mismatch/i);
  });

  it("rejects an unsupported version", () => {
    const id = encodePaymentLink({ ...makePayload(), v: 2 as unknown as 1 });
    expect(() => decodePaymentLink(id)).toThrow(/version/i);
  });
});
