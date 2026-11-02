import test from 'node:test';
import assert from 'node:assert/strict';
import {
    applyFoodMarkup,
    extractMarkupFromMarkedUpAmount,
} from '../src/modules/food/admin/services/foodMarkup.service.js';
import { getRestaurantBaseSubtotal } from '../src/modules/food/orders/services/foodTransaction.service.js';

// Admin's configured markup: 20%.
const MULTIPLIER = 1.2;

test('a restaurant price of 100 is shown to the customer as 120', () => {
    assert.equal(applyFoodMarkup(100, MULTIPLIER), 120);
});

test('the markup is carved back out of the marked-up subtotal', () => {
    assert.equal(extractMarkupFromMarkedUpAmount(120, MULTIPLIER), 20);
    assert.equal(extractMarkupFromMarkedUpAmount(240, MULTIPLIER), 40);
});

test('the restaurant is charged and paid on its own price, not the marked-up one', () => {
    const pricing = { subtotal: 120, markupAmount: 20 };
    assert.equal(getRestaurantBaseSubtotal(pricing), 100);
});

test('orders placed before the markup existed are unaffected', () => {
    assert.equal(getRestaurantBaseSubtotal({ subtotal: 120 }), 120);
    assert.equal(getRestaurantBaseSubtotal({ subtotal: 120, markupAmount: 0 }), 120);
});

test('no markup configured means no markup is extracted', () => {
    assert.equal(extractMarkupFromMarkedUpAmount(100, 1), 0);
    assert.equal(extractMarkupFromMarkedUpAmount(100, 0), 0);
    assert.equal(extractMarkupFromMarkedUpAmount(0, MULTIPLIER), 0);
});

test('markup never exceeds the amount it was taken from', () => {
    const markup = extractMarkupFromMarkedUpAmount(50, 5);
    assert.ok(markup <= 50);
    assert.ok(markup >= 0);
});

test('base subtotal never goes negative', () => {
    assert.equal(getRestaurantBaseSubtotal({ subtotal: 10, markupAmount: 50 }), 0);
});
