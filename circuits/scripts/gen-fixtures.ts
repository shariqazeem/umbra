/**
 * Produce consistent shield + withdraw circuit inputs for the vertical slice using
 * @umbra/wallet-core, so the off-chain note/tree exactly match what the contract
 * computes on-chain. Writes circuits/build/{shield,withdraw}_input.json + meta.
 *
 * Run via: corepack pnpm exec tsx circuits/scripts/gen-fixtures.ts
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Address } from "@stellar/stellar-sdk";
import {
  MerkleTree,
  buildShieldInput,
  buildTransferInput,
  buildWithdrawInput,
  commitment,
  makeNote,
  nullifier,
  recipientField,
} from "@umbra/wallet-core";

const here = dirname(fileURLToPath(import.meta.url));
const build = join(here, "..", "build");
mkdirSync(build, { recursive: true });

const AMOUNT = 1000n;

// C1 — the withdraw proof is bound to a concrete payout address. PAYEE is pinned to the
// same value as contracts/umbra-pool/src/test.rs, so the regenerated fixture exercises the
// on-chain `recipient == field(to)` check. A contract (`C…`) address is used so the custom
// test SAC can credit it without a classic-account trustline (the binding logic is
// identical for the `G…` payout addresses used in production). `field(addr)` mirrors the
// contract's `address_to_field` and the wallet's `addressToField`: sha256 of the address
// ScVal XDR with the top byte cleared (always a valid BLS12-381 Fr element).
const PAYEE = "CCG4XWI5PQXJ22L6PCCFJU5YTPFDI7EBJKSVQ4WMI45DIHG4UPHOSIXG";
function addressToField(addr: string): bigint {
  const xdr = Address.fromString(addr).toScVal().toXDR("raw");
  const h = createHash("sha256").update(xdr).digest();
  h[0] = 0;
  return BigInt("0x" + h.toString("hex"));
}
const RECIPIENT = recipientField(addressToField(PAYEE));

// 1. Make a note and shield it (insert its commitment into a fresh tree at index 0).
const note = makeNote(AMOUNT);
const cm = commitment(note);
const tree = new MerkleTree();
note.leafIndex = tree.insert(cm);

// 2. Build the shield + withdraw circuit inputs.
const shieldInput = buildShieldInput(note);
const withdrawInput = buildWithdrawInput(note, tree, RECIPIENT);

writeFileSync(join(build, "shield_input.json"), JSON.stringify(shieldInput, null, 2));
writeFileSync(join(build, "withdraw_input.json"), JSON.stringify(withdrawInput, null, 2));

// 3. Confidential transfer ("private send", 1-in / 1-out): spend the shielded note → a
// recipient note of the SAME (hidden) value. The amount is never revealed on-chain.
const out = makeNote(AMOUNT); // recipient note, same value, fresh secret
const transferInput = buildTransferInput(note, tree, out);
writeFileSync(join(build, "transfer_input.json"), JSON.stringify(transferInput, null, 2));
writeFileSync(
  join(build, "slice_meta.json"),
  JSON.stringify(
    {
      amount: AMOUNT.toString(),
      commitment: "0x" + cm.toString(16),
      leafIndex: note.leafIndex,
      root: "0x" + tree.path(note.leafIndex).root.toString(16),
      nullifier: "0x" + nullifier(note, note.leafIndex).toString(16),
      recipient: "0x" + RECIPIENT.toString(16),
    },
    null,
    2,
  ),
);

// eslint-disable-next-line no-console
console.log("wrote shield_input.json, withdraw_input.json, slice_meta.json");
// eslint-disable-next-line no-console
console.log("commitment =", "0x" + cm.toString(16));
