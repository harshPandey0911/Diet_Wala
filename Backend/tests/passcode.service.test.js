import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { config } from "../src/config/env.js";
import { FoodUser } from "../src/core/users/user.model.js";
import { FoodRefreshToken } from "../src/core/refreshTokens/refreshToken.model.js";
import { loginWithPasscode } from "../src/core/auth/auth.service.js";

const originalFindOne = FoodUser.findOne;
const originalRefreshCreate = FoodRefreshToken.create;

const mockAccount = async ({ passcode = "1234", attempts = 0, lockedUntil = null } = {}) => {
  const updates = [];
  const account = {
    _id: { toString: () => "507f1f77bcf86cd799439011" }, phone: "9876543210", role: "USER",
    name: "Test User", isActive: true, hasPasscode: true,
    passcodeHash: await bcrypt.hash(passcode, 4), passcodeFailedAttempts: attempts,
    passcodeLockedUntil: lockedUntil,
    toObject() { return { ...this }; },
  };
  account.constructor = { updateOne: async (...args) => { updates.push(args); } };
  FoodUser.findOne = () => ({ select: async () => account });
  FoodRefreshToken.create = async () => ({});
  return { account, updates };
};

test.afterEach(() => {
  FoodUser.findOne = originalFindOne;
  FoodRefreshToken.create = originalRefreshCreate;
});

test("logs in with the correct passcode and returns the normal token shape", async () => {
  config.jwtAccessSecret = "test-access-secret";
  config.jwtRefreshSecret = "test-refresh-secret";
  await mockAccount();
  const result = await loginWithPasscode("user", "9876543210", "1234");
  assert.ok(result.accessToken);
  assert.ok(result.refreshToken);
  assert.equal(result.user.hasPasscode, true);
  assert.equal(result.user.passcodeHash, undefined);
});

test("rejects an incorrect passcode and records the failed attempt", async () => {
  const { updates } = await mockAccount();
  await assert.rejects(() => loginWithPasscode("user", "9876543210", "9999"), /Invalid phone number or passcode/);
  assert.equal(updates[0][1].$set.passcodeFailedAttempts, 1);
});

test("locks passcode login for fifteen minutes after five failures", async () => {
  const { updates } = await mockAccount({ attempts: 4 });
  await assert.rejects(() => loginWithPasscode("user", "9876543210", "9999"));
  assert.ok(updates[0][1].$set.passcodeLockedUntil > new Date());
});
