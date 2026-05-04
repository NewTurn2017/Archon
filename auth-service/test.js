'use strict';
// Run with: node auth-service/test.js

const assert = require('node:assert/strict');
const { createHmac, timingSafeEqual } = require('node:crypto');

process.env.AUTH_USERNAME = process.env.AUTH_USERNAME || 'tester';
process.env.AUTH_PASSWORD_HASH =
  process.env.AUTH_PASSWORD_HASH || '$2a$10$7EqJtq98hPqEX7fNZaFWoO7r6k7bGZ9QiZ8K5XaF1QG7uQjR2XqZ2';
process.env.COOKIE_SECRET =
  process.env.COOKIE_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// ── isSafeRedirect ─────────────────────────────────────────────────────────
const { isSafeRedirect } = require('./server.js');

// Safe paths (must return true)
assert.equal(isSafeRedirect('/'), true, 'root path');
assert.equal(isSafeRedirect('/dashboard'), true, 'normal path');
assert.equal(isSafeRedirect('/api/health'), true, 'nested path');
assert.equal(isSafeRedirect('/api/v1/resource'), true, 'deep nested path');

// Open redirect attempts (must return false)
assert.equal(isSafeRedirect('//evil.com'), false, 'protocol-relative //');
assert.equal(isSafeRedirect('/\\evil.com'), false, 'backslash after slash');
assert.equal(isSafeRedirect('https://evil.com'), false, 'absolute https');
assert.equal(isSafeRedirect('http://evil.com'), false, 'absolute http');
assert.equal(isSafeRedirect('javascript://'), false, 'javascript scheme');
assert.equal(isSafeRedirect('//'), false, 'bare //');
assert.equal(isSafeRedirect(''), false, 'empty string');
assert.equal(isSafeRedirect('relative/no-leading-slash'), false, 'no leading slash');

console.log('isSafeRedirect: all assertions passed');

// ── signCookie / verifyCookie ──────────────────────────────────────────────
const { signCookie, verifyCookie } = require('./server.js');

// Round-trip: sign then verify returns original value
const signed = signCookie('authenticated');
assert.equal(verifyCookie(signed), 'authenticated', 'valid cookie round-trip');

// Tampered signature returns null
const tampered = signed.slice(0, -3) + 'AAA';
assert.equal(verifyCookie(tampered), null, 'tampered signature returns null');

// Missing dot returns null
assert.equal(verifyCookie('nodothere'), null, 'missing dot returns null');

// Empty string returns null
assert.equal(verifyCookie(''), null, 'empty string returns null');

// Wrong secret returns null — construct a cookie signed with a different secret
const wrongSig = createHmac('sha256', 'wrong-secret').update('authenticated').digest('base64url');
assert.equal(verifyCookie(`authenticated.${wrongSig}`), null, 'wrong secret returns null');

console.log('signCookie/verifyCookie: all assertions passed');
console.log('All tests passed.');
