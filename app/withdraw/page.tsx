import { redirect } from "next/navigation";

// The standalone withdraw flow has been folded into the unified wallet, whose Unshield view
// now supports arbitrary-amount cash-out with private change (a join-split withdrawal). Keep
// the /withdraw URL working by redirecting to the canonical wallet.
export default function WithdrawPage() {
  redirect("/wallet");
}
