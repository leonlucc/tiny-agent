import assert from 'node:assert/strict';
import test from 'node:test';

import { canOperateSession } from '../js/app.js';


test('canOperateSession returns true in idle state', () => {
    assert.equal(canOperateSession({ isTyping: false, isSessionLoading: false }), true);
});

test('canOperateSession blocks when user is typing', () => {
    assert.equal(canOperateSession({ isTyping: true, isSessionLoading: false }), false);
});

test('canOperateSession blocks when session is loading', () => {
    assert.equal(canOperateSession({ isTyping: false, isSessionLoading: true }), false);
});

test('canOperateSession allows loading state when allowLoading=true', () => {
    assert.equal(canOperateSession({ isTyping: false, isSessionLoading: true }, true), true);
});

test('canOperateSession still blocks typing when allowLoading=true', () => {
    assert.equal(canOperateSession({ isTyping: true, isSessionLoading: true }, true), false);
});
