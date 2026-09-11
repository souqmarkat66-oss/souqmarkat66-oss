/** Accept the digits commonly pasted from Arabic email clients and keyboards. */
export function normalizeResetOtp(value: string): string {
  return value
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/\D/g, "")
    .slice(0, 6);
}