import { Banknote, Landmark, CreditCard, Wallet, PiggyBank, HandCoins, type LucideIcon } from "lucide-react";
import type { AccountKind } from "../lib/types";

export const ACCOUNT_KINDS: { id: AccountKind; label: string; icon: LucideIcon }[] = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "bank", label: "Bank account", icon: Landmark },
  { id: "card", label: "Credit card", icon: CreditCard },
  { id: "wallet", label: "E-wallet", icon: Wallet },
  { id: "savings", label: "Savings", icon: PiggyBank },
  { id: "loan", label: "Loan", icon: HandCoins },
];

export function AccountIcon({ kind, color, size = 18, tile }: { kind: AccountKind; color: string; size?: number; tile?: boolean }) {
  const Icon = ACCOUNT_KINDS.find((k) => k.id === kind)?.icon ?? Wallet;
  if (!tile) return <Icon size={size} color={color} aria-hidden="true" style={{ flex: "none" }} />;
  return (
    <span className="cat-tile" style={{ background: `${color}1F`, color }} aria-hidden="true">
      <Icon size={size} />
    </span>
  );
}
