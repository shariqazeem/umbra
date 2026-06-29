/**
 * Produce consistent shield + withdraw circuit inputs for the vertical slice using
 * @umbra/wallet-core, so the off-chain note/tree exactly match what the contract
 * computes on-chain. Writes circuits/build/{shield,withdraw}_input.json + meta.
 *
 * Run via: corepack pnpm exec tsx circuits/scripts/gen-fixtures.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MerkleTree,
  buildShieldInput,
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
const RECIPIENT = recipientField(0x1234_5678_9abc_def0_1122_3344n); // a bound recipient identity

// 1. Make a note and shield it (insert its commitment into a fresh tree at index 0).
const note = makeNote(AMOUNT);
const cm = commitment(note);
const tree = new MerkleTree();
note.leafIndex = tree.insert(cm);

// 2. Build both circuit inputs.
const shieldInput = buildShieldInput(note);
const withdrawInput = buildWithdrawInput(note, tree, RECIPIENT);

writeFileSync(join(build, "shield_input.json"), JSON.stringify(shieldInput, null, 2));
writeFileSync(join(build, "withdraw_input.json"), JSON.stringify(withdrawInput, null, 2));
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
