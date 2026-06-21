// Money is stored everywhere as integer sen (1 MYR = 100 sen) to avoid floating
// point drift in pricing math. These helpers are the only place that bridges
// between display (RM) and storage (sen).

export const SEN_PER_RINGGIT = 100;

export function ringgitToSen(ringgit: number): number {
  return Math.round(ringgit * SEN_PER_RINGGIT);
}

export function senToRinggit(sen: number): number {
  return sen / SEN_PER_RINGGIT;
}

export function formatMoney(sen: number, currency = "MYR"): string {
  const amount = senToRinggit(sen).toLocaleString("en-MY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const symbol = currency === "MYR" ? "RM" : `${currency} `;
  return `${symbol}${amount}`;
}

/** Apply a percent discount to a sen amount, rounding to whole sen. */
export function applyDiscountPercent(sen: number, percent: number): number {
  return Math.round(sen * (1 - percent / 100));
}

/** Percentage by which `price` exceeds `floor`, clamped at 0. */
export function percentAbove(price: number, floor: number): number {
  if (floor <= 0) return 0;
  return Math.max(0, ((price - floor) / floor) * 100);
}
