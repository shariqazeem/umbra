// @vitest-environment node
// Run in node (not jsdom) so we get Node 20+'s native Web Crypto (crypto.subtle).

import { describe, expect, it } from "vitest";
import {
  createAuditPacket,
  decryptAuditPacket,
  decryptAuditRecord,
  encryptAuditRecord,
  exportViewingKey,
  generateViewingKey,
  importViewingKey,
  type AuditRecord,
} from "@/lib/umbra/viewing-key";

function sample(id: string, amount: string): AuditRecord {
  return {
    id,
    kind: "shield",
    timestamp: "2026-06-26T00:00:00.000Z",
    network: "testnet",
    poolContractId: "CCWIFQIDDDJ3UUOA2N4MAU5YXISOR2RLJXAPNSCITEGZD2EQXOKDGZHU",
    txHash: "daf74520d90cc87a5703b4a6ee8598c99bf4387bc90040a6d18d222f2ca0238d",
    commitment: "12345678901234567890",
    leafIndex: 0,
    amount,
    asset: "XLM",
    direction: "in",
    disclosureNote: `Shielded ${amount} XLM into the Umbra pool.`,
  };
}

describe("viewing key & audit packets", () => {
  it("generates and round-trips a viewing key string", async () => {
    const key = await generateViewingKey();
    const str = await exportViewingKey(key);
    expect(str).toMatch(/^umbra-vk-v1:/);
    const reimported = await importViewingKey(str);
    // prove it's the same key by decrypting under the re-imported handle
    const blob = await encryptAuditRecord(key, sample("a", "100"));
    const back = await decryptAuditRecord(reimported, blob);
    expect(back.amount).toBe("100");
  });

  it("encrypts and decrypts a single record", async () => {
    const key = await generateViewingKey();
    const rec = sample("a", "42");
    const blob = await encryptAuditRecord(key, rec);
    expect(typeof blob.iv).toBe("string");
    expect(typeof blob.data).toBe("string");
    const out = await decryptAuditRecord(key, blob);
    expect(out).toEqual(rec);
  });

  it("creates a packet of many records and decrypts it back", async () => {
    const key = await generateViewingKey();
    const recs = [sample("a", "10"), sample("b", "20"), sample("c", "30")];
    const packet = await createAuditPacket(key, recs, { createdAt: "2026-06-26T00:00:00.000Z" });
    expect(packet.format).toBe("umbra-audit-packet");
    expect(packet.count).toBe(3);
    const decoded = await decryptAuditPacket(key, packet);
    expect(decoded.map((r) => r.amount)).toEqual(["10", "20", "30"]);
  });

  it("fails to decrypt with the wrong viewing key", async () => {
    const key = await generateViewingKey();
    const wrong = await generateViewingKey();
    const packet = await createAuditPacket(key, [sample("a", "10")]);
    await expect(decryptAuditPacket(wrong, packet)).rejects.toThrow(/wrong viewing key|Decryption failed/i);
  });

  it("rejects a malformed packet gracefully", async () => {
    const key = await generateViewingKey();
    await expect(decryptAuditPacket(key, { format: "nope" })).rejects.toThrow(/audit packet/i);
    await expect(decryptAuditPacket(key, { format: "umbra-audit-packet", version: 1 })).rejects.toThrow(/records/i);
    await expect(
      decryptAuditPacket(key, { format: "umbra-audit-packet", version: 99, records: [] }),
    ).rejects.toThrow(/version/i);
  });

  it("rejects an invalid viewing key string", async () => {
    await expect(importViewingKey("umbra-vk-v1:zz")).rejects.toThrow(/Invalid viewing key/i);
  });
});
