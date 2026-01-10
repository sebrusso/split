/**
 * Exchange Rate Utility
 * Uses the Frankfurter API (free, no auth required) to fetch currency exchange rates
 * https://api.frankfurter.app
 */

import logger from "./logger";

// Cache exchange rates for 1 hour
const CACHE_DURATION_MS = 60 * 60 * 1000;

interface CachedRate {
  rate: number;
  timestamp: number;
}

// In-memory cache for exchange rates
const rateCache = new Map<string, CachedRate>();

/**
 * Get the cache key for a currency pair
 */
function getCacheKey(from: string, to: string): string {
  return `${from.toUpperCase()}-${to.toUpperCase()}`;
}

/**
 * Check if a cached rate is still valid
 */
function isCacheValid(cached: CachedRate | undefined): boolean {
  if (!cached) return false;
  return Date.now() - cached.timestamp < CACHE_DURATION_MS;
}

/**
 * Fetch exchange rate from Frankfurter API
 * @param from Source currency code (e.g., "USD")
 * @param to Target currency code (e.g., "EUR")
 * @returns Exchange rate (how many `to` units per 1 `from` unit)
 */
export async function getExchangeRate(from: string, to: string): Promise<number> {
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();

  // Same currency - return 1
  if (fromUpper === toUpper) {
    return 1;
  }

  // Check cache first
  const cacheKey = getCacheKey(fromUpper, toUpper);
  const cached = rateCache.get(cacheKey);
  if (isCacheValid(cached)) {
    return cached!.rate;
  }

  try {
    const response = await fetch(
      `https://api.frankfurter.app/latest?from=${fromUpper}&to=${toUpper}`
    );

    if (!response.ok) {
      throw new Error(`Frankfurter API error: ${response.status}`);
    }

    const data = await response.json();
    const rate = data.rates?.[toUpper];

    if (typeof rate !== "number") {
      throw new Error(`Invalid rate returned for ${fromUpper} to ${toUpper}`);
    }

    // Cache the rate
    rateCache.set(cacheKey, {
      rate,
      timestamp: Date.now(),
    });

    // Also cache the inverse rate
    const inverseKey = getCacheKey(toUpper, fromUpper);
    rateCache.set(inverseKey, {
      rate: 1 / rate,
      timestamp: Date.now(),
    });

    return rate;
  } catch (error) {
    logger.error("Error fetching exchange rate:", error);

    // Return 1 as fallback (no conversion) to avoid breaking the app
    return 1;
  }
}

/**
 * Convert an amount from one currency to another
 * @param amount Amount in the source currency
 * @param from Source currency code
 * @param to Target currency code
 * @returns Amount in the target currency
 */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  const rate = await getExchangeRate(from, to);
  return amount * rate;
}

/**
 * Convert an amount to group currency using a stored exchange rate
 * This is used for balance calculations with historical rates
 */
export function convertToGroupCurrency(
  amount: number,
  expenseCurrency: string | null | undefined,
  exchangeRate: number | null | undefined,
  groupCurrency: string
): number {
  // If no expense currency specified, assume it's already in group currency
  if (!expenseCurrency || expenseCurrency === groupCurrency) {
    return amount;
  }

  // If we have a stored exchange rate, use it
  if (exchangeRate && exchangeRate > 0) {
    return amount * exchangeRate;
  }

  // No conversion possible - return original amount
  // This shouldn't happen in practice as we always store the rate
  return amount;
}

/**
 * Get exchange rate with timestamp for storing with an expense
 */
export async function getExchangeRateWithTimestamp(
  from: string,
  to: string
): Promise<{ rate: number; timestamp: string }> {
  const rate = await getExchangeRate(from, to);
  return {
    rate,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Clear the rate cache (useful for testing or forcing fresh rates)
 */
export function clearRateCache(): void {
  rateCache.clear();
}

/**
 * List of supported currency codes
 * Based on Frankfurter API supported currencies
 */
export const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "\u20AC", name: "Euro" },
  { code: "GBP", symbol: "\u00A3", name: "British Pound" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "JPY", symbol: "\u00A5", name: "Japanese Yen" },
  { code: "INR", symbol: "\u20B9", name: "Indian Rupee" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "CNY", symbol: "\u00A5", name: "Chinese Yuan" },
  { code: "MXN", symbol: "$", name: "Mexican Peso" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "KRW", symbol: "\u20A9", name: "South Korean Won" },
  { code: "THB", symbol: "\u0E3F", name: "Thai Baht" },
];

/**
 * Get currency info by code
 */
export function getCurrencyInfo(code: string): typeof SUPPORTED_CURRENCIES[0] | undefined {
  return SUPPORTED_CURRENCIES.find(c => c.code === code.toUpperCase());
}

/**
 * Format a currency amount with the appropriate symbol
 */
export function formatWithCurrency(amount: number, currencyCode: string): string {
  const currency = getCurrencyInfo(currencyCode);
  const symbol = currency?.symbol || currencyCode;

  // For currencies like JPY and KRW that don't use decimals
  const noDecimals = ["JPY", "KRW"].includes(currencyCode.toUpperCase());
  const formatted = noDecimals
    ? Math.round(amount).toLocaleString()
    : amount.toFixed(2);

  return `${symbol}${formatted}`;
}
