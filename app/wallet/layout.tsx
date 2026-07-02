import type { ReactNode } from "react";
import { InviteGate } from "@/components/umbra/invite-gate";

// The wallet is the money surface, so it sits behind the invite gate. Marketing/proof/mainnet
// routes stay public (people can see what Umbra is; access to USE it is invite-only). When the
// gate is disarmed (NEXT_PUBLIC_UMBRA_INVITE_REQUIRED unset) this is a transparent pass-through.
export default function WalletLayout({ children }: { children: ReactNode }) {
  return <InviteGate>{children}</InviteGate>;
}
