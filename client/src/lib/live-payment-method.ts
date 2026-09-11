// Legacy selector keys are retained to avoid changing its display/state logic.
// The consolidated payment API uses canonical method names, not these keys.
export const LIVE_PAYMENT_METHODS = {
  vodafone: "etisalat",
  vodafone2: "vodafone",
  instapay: "instapay",
  bank: "souq",
} as const;