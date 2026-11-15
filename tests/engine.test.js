import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE, localAnalyze, Terms, solidity, compile, legalText } from '../server/engine.js';
export function validTerms() { return { ...localAnalyze(SAMPLE).terms, acceptance: 'Deliver the listed files and a working responsive website. Client reviews each milestone within five business days.', jurisdiction: 'California, United States' }; }
test('extracts sample parties, prices and calendar dates without inventing missing clauses', () => {
  const {terms,risks,provider} = localAnalyze(SAMPLE);
  assert.equal(terms.client,'Acme Studio'); assert.equal(terms.contractor,'Northstar Design');
  assert.equal(terms.total,12000); assert.deepEqual(terms.milestones.map(m => m.amount),[3000,4000,5000]);
  assert.equal(terms.scope,'design and build a new marketing website');
  assert.deepEqual(terms.milestones.map(m => m.deadline),['2026-12-01','2026-12-15','2027-01-10']);
  assert.equal(terms.jurisdiction,''); assert.equal(terms.acceptance,''); assert.equal(risks.length,2); assert.equal(provider,'Local parser');
});
test('incomplete agreements cannot generate and unsupported currencies are rejected', () => {
  assert.equal(Terms.safeParse(localAnalyze(SAMPLE).terms).success,false);
  assert.throws(() => localAnalyze(SAMPLE.replace('USD','EUR')),/USD/);
  assert.equal(localAnalyze('A company asks a consultant to do some work at a price to be agreed.').terms.client,'');
  assert.equal(localAnalyze(SAMPLE.replace('December 1, 2026','February 30, 2026')).terms.milestones[0].deadline,'');
});
test('rejects mismatched totals, sub-cent payments and impossible dates', () => {
  const t = validTerms();
  assert.equal(Terms.safeParse({...t,total:11000}).success,false);
  assert.equal(Terms.safeParse({...t,total:12000.001}).success,false);
  assert.equal(Terms.safeParse({...t,milestones:[{...t.milestones[0],amount:12000,deadline:'2026-02-30'}]}).success,false);
});
test('compiles executable Solidity with payments consistent with the legal draft', () => {
  const t = Terms.parse(validTerms()); const source = solidity(t); const result = compile(source);
  assert.ok(result.artifact.evm.bytecode.object.length > 100);
  assert.match(source,/total = 12000000000;/); assert.match(source,/amounts.push\(3000000000\)/);
  const text = legalText(t).map(s => s[1]).join('\n'); assert.match(text,/USD 12000.00/); assert.match(text,/USD 3000.00/);
  assert.match(text,/California/); assert.match(text,/Both parties must consent/);
});
