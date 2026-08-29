const PAYMENT_METHOD_LABELS: Record<string, string> = {
  evc_plus: "Merchant",
  edahab: "eDahab",
  premier_wallet: "Premier Wallet",
  waafi: "Premier Wallet",
  cash: "Cash",
  card: "Card",
  online: "Online",
};

export function formatPaymentMethod(method?: string | null, providerName?: string | null) {
  if (providerName?.trim()) return providerName.trim();
  if (!method) return "—";
  const key = method.toLowerCase();
  if (PAYMENT_METHOD_LABELS[key]) return PAYMENT_METHOD_LABELS[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
