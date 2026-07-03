import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * WithdrawReveal is data-driven from infra/deploy/deployment.json. We mock that
 * import to exercise both states without ever touching (or fabricating values in)
 * the real file.
 */

const PENDING = {
  network: "testnet",
  shieldTx: "",
  withdrawTx: "",
  shieldExplorerUrl: "",
  withdrawExplorerUrl: "",
};

const POPULATED = {
  network: "testnet",
  shieldTx: "a1b2c3d4e5f6a1b2c3d4e5f60123456789abcdef0123456789abcdef01234567",
  withdrawTx: "9988776655443322110099887766554433221100aabbccddeeff00112233abcd",
  shieldExplorerUrl:
    "https://stellar.expert/explorer/testnet/tx/a1b2c3d4e5f6a1b2c3d4e5f60123456789abcdef0123456789abcdef01234567",
  withdrawExplorerUrl:
    "https://stellar.expert/explorer/testnet/tx/9988776655443322110099887766554433221100aabbccddeeff00112233abcd",
};

async function renderWith(data: Record<string, unknown>) {
  vi.resetModules();
  vi.doMock("@/infra/deploy/deployment.json", () => ({ default: data }));
  const { WithdrawReveal } = await import("@/components/umbra/withdraw-reveal");
  render(<WithdrawReveal amount="50" asset="XLM" />);
}

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("WithdrawReveal — split-screen layout (both states)", () => {
  it("renders the human story, both panels, and both tx kinds", async () => {
    await renderWith(PENDING);
    expect(screen.getByText("You received 50 XLM from a private link.")).toBeInTheDocument();
    expect(screen.getByText("What you did")).toBeInTheDocument();
    expect(screen.getByText("What Stellar sees")).toBeInTheDocument();
    expect(screen.getByText("Pool deposit")).toBeInTheDocument();
    expect(screen.getByText("Pool withdrawal")).toBeInTheDocument();
    expect(screen.getByText("No shared key")).toBeInTheDocument(); // the disconnect motif
  });
});

describe("WithdrawReveal — PENDING degrades gracefully", () => {
  it("shows placeholders, no live links, and never a fake hash", async () => {
    await renderWith(PENDING);

    // tasteful placeholder, twice (deposit + withdrawal)
    expect(screen.getAllByText("Awaiting mainnet deploy")).toHaveLength(2);

    // no stellar.expert links anywhere, no tx links → no fabricated hash rendered
    expect(document.querySelectorAll('a[href*="stellar.expert"]')).toHaveLength(0);
    expect(document.querySelectorAll('a[href*="/tx/"]')).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/…[0-9a-f]{6}/i); // no truncated hash

    // closing line present but degraded (no live link)
    expect(screen.getByText(/This separation is enforced by a proof/)).toBeInTheDocument();
    expect(screen.getByText(/live link appears once deployed/i)).toBeInTheDocument();
    expect(screen.queryByText("here it is")).not.toBeInTheDocument();
  });
});

describe("WithdrawReveal — populated shows real links", () => {
  it("links both tx cards + the closing line to stellar.expert, with OpSec rel", async () => {
    await renderWith(POPULATED);

    expect(screen.queryByText("Awaiting testnet deploy")).not.toBeInTheDocument();

    const shieldLink = document.querySelector(
      `a[href="${POPULATED.shieldExplorerUrl}"]`,
    ) as HTMLAnchorElement | null;
    const withdrawLink = document.querySelector(
      `a[href="${POPULATED.withdrawExplorerUrl}"]`,
    ) as HTMLAnchorElement | null;
    expect(shieldLink).not.toBeNull();
    expect(withdrawLink).not.toBeNull();

    // truncated REAL hash shown (first8…last6), not a fabricated one
    expect(screen.getByText(/a1b2c3d4…234567/)).toBeInTheDocument();

    // closing line links to the withdraw/verify tx
    const closing = screen.getByText("here it is");
    expect(closing.closest("a")).toHaveAttribute("href", POPULATED.withdrawExplorerUrl);

    // G9 OpSec seam: no referrer leakage to the third-party explorer
    for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href*="stellar.expert"]')) {
      expect(a.getAttribute("rel")).toContain("noreferrer");
      expect(a.getAttribute("referrerpolicy")).toBe("no-referrer");
    }
  });
});
