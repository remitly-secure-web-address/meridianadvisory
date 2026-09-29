export const natures = [
  ["inquiry", "Inquiry"],
  ["complaint", "Complaint"],
  ["explanation", "Explanation"],
];

export const categories = [
  ["first-sale", "The store has never made a first sale"],
  ["sales-declined", "Sales have stopped, declined, or not resumed"],
  ["traffic", "Little traffic, or the store is difficult to find"],
  ["conversion", "Visitors arrive, but few of them purchase"],
  ["advertising", "Paid advertising is not returning a result"],
  ["checkout", "Checkout, payments, or another technical fault"],
  ["theme", "Theme, installed apps, or the speed of the store"],
  ["offer", "Product, pricing, or the offer"],
  ["retention", "Email, retention, or repeat purchase"],
  ["orders", "Orders, refunds, fraud, or chargebacks"],
  ["launch", "The store is still being prepared"],
  ["account", "Account, policy, or payout hold"],
  ["other", "Other"],
];

export const plans = [
  ["starter", "Starter"],
  ["basic", "Basic"],
  ["shopify", "Shopify"],
  ["advanced", "Advanced"],
  ["plus", "Plus"],
  ["other", "Another plan"],
];

export const marketing = [
  ["none", "None at present"],
  ["organic", "Organic search"],
  ["paid", "Paid advertising"],
  ["email", "Email"],
  ["social", "Social media"],
  ["influencers", "Influencers or affiliates"],
  ["marketplaces", "Online marketplaces"],
  ["other", "Other"],
];

export function labelOf(list, value) {
  const found = list.find(([entry]) => entry === value);
  return found ? found[1] : "";
}
