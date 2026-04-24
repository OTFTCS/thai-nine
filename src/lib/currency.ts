export type SupportedCurrency = "THB" | "USD";

export function defaultCurrencyForCountry(countryCode: string | null | undefined): SupportedCurrency {
  if (!countryCode) return "USD";
  return countryCode.trim().toUpperCase() === "TH" ? "THB" : "USD";
}
