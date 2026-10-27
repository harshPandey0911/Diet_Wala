import test from "node:test";
import assert from "node:assert/strict";
import { validatePasscodeLoginDto, validatePasscodeStatusDto, validatePasscodeUpdateDto } from "../src/dtos/auth/passcode.dto.js";

test("normalizes a phone and accepts exactly four passcode digits", () => {
  assert.deepEqual(validatePasscodeLoginDto({ module: "user", phone: "+91 98765 43210", passcode: "1234" }), {
    module: "user", phone: "9876543210", passcode: "1234",
  });
});

test("rejects invalid role, phone and non-four-digit passcodes", () => {
  assert.throws(() => validatePasscodeStatusDto({ module: "admin", phone: "9876543210" }));
  assert.throws(() => validatePasscodeLoginDto({ module: "delivery", phone: "123", passcode: "1234" }));
  assert.throws(() => validatePasscodeLoginDto({ module: "restaurant", phone: "9876543210", passcode: "12a4" }));
});

test("rejects mismatched passcode confirmation", () => {
  assert.throws(() => validatePasscodeUpdateDto({ newPasscode: "1234", confirmPasscode: "4321" }), /Passcodes do not match/);
});
