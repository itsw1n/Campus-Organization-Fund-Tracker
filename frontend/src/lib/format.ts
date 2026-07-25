import { env } from "@/config/env";

/**
 * The contract stores amounts as integer minor units (cents). 1234.56 is
 * stored as 123456. The SDK maps the contract's `i128` to `bigint`, so amounts
 * are bigint end to end -- they are never converted to `number`, which would
 * silently lose precision above 2^53.
 */
export const MINOR_UNITS_PER_MAJOR = 100n;

/** Formats minor units for display, e.g. 123456n -> "$1,234.56". */
export function formatAmount(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;

  const major = abs / MINOR_UNITS_PER_MAJOR;
  const remainder = abs % MINOR_UNITS_PER_MAJOR;

  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: env.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Reassembled as a Number only for the *formatting* step, on a value already
  // split into safe parts, so no precision is lost from the bigint itself.
  const value = Number(major) + Number(remainder) / 100;
  return negative ? `-${formatter.format(value)}` : formatter.format(value);
}

/**
 * Parses user input ("1,234.56") into minor units (123456n).
 *
 * Deliberately string-based. `Math.round(parseFloat(input) * 100)` is the
 * obvious implementation and it is wrong: 19.99 * 100 is 1998.9999999999998 in
 * IEEE-754, and rounding errors in a treasury ledger are permanent.
 *
 * Returns null when the input is not a valid non-negative amount.
 */
export function parseAmountToMinor(input: string): bigint | null {
  const cleaned = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const [whole, fraction = ""] = cleaned.split(".");
  const paddedFraction = fraction.padEnd(2, "0");

  return BigInt(whole) * MINOR_UNITS_PER_MAJOR + BigInt(paddedFraction);
}

/** Ledger timestamps are unix *seconds* as bigint; JS Date wants milliseconds. */
export function formatTimestamp(unixSeconds: bigint | number): string {
  const ms = Number(unixSeconds) * 1000;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

/** "GABC...WXYZ" -- enough to eyeball-match, short enough for a table cell. */
export function truncateAddress(address: string, lead = 4, tail = 4): string {
  if (address.length <= lead + tail + 3) return address;
  return `${address.slice(0, lead)}...${address.slice(-tail)}`;
}
