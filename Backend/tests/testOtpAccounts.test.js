import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TEST_OTP_CODE,
    isTestOtpPhone,
    isPasscodeDisabledForTestAccount,
    listTestOtpPhones,
} from '../src/core/auth/testOtpAccounts.js';

const DEMO = '7879363299';
const OTHER = '9876543210';

test('the fixed OTP is 123456', () => {
    assert.equal(TEST_OTP_CODE, '123456');
});

test('only the configured number is a test account', () => {
    assert.equal(listTestOtpPhones().length, 1);
    assert.ok(isTestOtpPhone(DEMO));
    assert.ok(!isTestOtpPhone(OTHER));
});

test('the number is recognised however it is formatted', () => {
    assert.ok(isTestOtpPhone(DEMO));
    assert.ok(isTestOtpPhone(`+91${DEMO}`));
    assert.ok(isTestOtpPhone(`91${DEMO}`));
    assert.ok(isTestOtpPhone(` ${DEMO} `));
    assert.ok(isTestOtpPhone('+91 78793-63299'));
});

test('a number that merely looks similar is not a test account', () => {
    assert.ok(!isTestOtpPhone('7879363298'));
    assert.ok(!isTestOtpPhone('787936329'));
    assert.ok(!isTestOtpPhone('78793632990'));
    assert.ok(!isTestOtpPhone(''));
    assert.ok(!isTestOtpPhone(null));
    assert.ok(!isTestOtpPhone(undefined));
});

test('passcode is switched off for the user and restaurant accounts', () => {
    assert.ok(isPasscodeDisabledForTestAccount('user', DEMO));
    assert.ok(isPasscodeDisabledForTestAccount('restaurant', DEMO));
});

test('delivery keeps its passcode on the same number', () => {
    assert.ok(!isPasscodeDisabledForTestAccount('delivery', DEMO));
});

test('no other account loses its passcode', () => {
    assert.ok(!isPasscodeDisabledForTestAccount('user', OTHER));
    assert.ok(!isPasscodeDisabledForTestAccount('restaurant', OTHER));
    assert.ok(!isPasscodeDisabledForTestAccount('delivery', OTHER));
});

test('an unknown module never disables the passcode', () => {
    assert.ok(!isPasscodeDisabledForTestAccount('admin', DEMO));
    assert.ok(!isPasscodeDisabledForTestAccount('', DEMO));
    assert.ok(!isPasscodeDisabledForTestAccount(undefined, DEMO));
});
