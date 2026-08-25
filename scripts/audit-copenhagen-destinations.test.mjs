import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  COPENHAGEN_DESTINATION_CODES,
  COPENHAGEN_EUROPE_DESTINATION_CODES,
  auditCopenhagenDestinations,
} from './audit-copenhagen-destinations.mjs';

test('CPH destination snapshot contains 175 unique IATA codes', () => {
  assert.equal(COPENHAGEN_DESTINATION_CODES.length, 175);
  assert.equal(new Set(COPENHAGEN_DESTINATION_CODES).size, 175);
  assert.ok(COPENHAGEN_DESTINATION_CODES.every((code) => /^[A-Z]{3}$/.test(code)));
});

test('counts destination codes currently registered for heritage-journey', () => {
  const source = readFileSync(new URL('../src/data/airports.ts', import.meta.url), 'utf8');
  const result = auditCopenhagenDestinations(source);
  assert.equal(result.registered.length, 154);
  assert.equal(result.missing.length, 21);
});

test('all 136 European destinations are registered for heritage-journey', () => {
  const source = readFileSync(new URL('../src/data/airports.ts', import.meta.url), 'utf8');
  const result = auditCopenhagenDestinations(source);
  const registered = new Set(result.registered);
  assert.equal(COPENHAGEN_EUROPE_DESTINATION_CODES.length, 136);
  assert.deepEqual(COPENHAGEN_EUROPE_DESTINATION_CODES.filter((code) => !registered.has(code)), []);
});
