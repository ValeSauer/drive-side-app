export function countryCodeToFlag(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2) return '🏳️';
  const code = countryCode.toUpperCase();
  const base = 127397;
  return String.fromCodePoint(
    base + code.charCodeAt(0),
    base + code.charCodeAt(1),
  );
}
