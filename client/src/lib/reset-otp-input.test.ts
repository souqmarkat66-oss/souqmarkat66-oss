import test from "node:test";
import assert from "node:assert/strict";
import { normalizeResetOtp } from "./reset-otp-input";

test("reset OTP accepts Arabic, Persian, ASCII and pasted whitespace without losing leading zeros", () => {
  assert.equal(normalizeResetOtp("٠١٢٣٤٥"), "012345");
  assert.equal(normalizeResetOtp("۰۱۲۳۴۵"), "012345");
  assert.equal(normalizeResetOtp(" 01 2345 "), "012345");
  assert.equal(normalizeResetOtp("1234567"), "123456");
});