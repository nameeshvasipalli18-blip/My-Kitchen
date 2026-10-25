import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSplitResults } from './splitResults.js';

const participants = ['Alex', 'Sam', 'Jo'];
const bill = (date, paidBy, price, splitBetween = participants) => ({
  date, participants,
  items: [{ price, paidBy, splitBetween }],
});

test('groups by bill month and year, newest first, while keeping the all-time split', () => {
  const results = buildSplitResults(participants, [
    bill('2025-01-31', 'Alex', 30),
    bill('2026-01-01', 'Sam', 60),
    bill('2026-01-31', 'Alex', 30),
    bill('2026-02-01', 'Jo', 90),
  ]);
  assert.deepEqual(results.monthlyResults.map(({ month }) => month), ['2026-02', '2026-01', '2025-01']);
  assert.equal(results.allResult.total, 210);
  assert.equal(results.monthlyResults[1].result.total, 90);
  assert.equal(results.monthlyResults[1].result.tripCount, 2);
  assert.deepEqual(results.monthlyResults[1].result.balances, { Alex: 0, Sam: 30, Jo: -30 });
  assert.deepEqual(results.monthlyResults[1].result.settlements, [{ from: 'Jo', to: 'Sam', amount: 30 }]);
});

test('opposite payments settle all time but remain payable within each month', () => {
  const results = buildSplitResults(['Alex', 'Sam'], [
    bill('2026-01-31', 'Alex', 20, ['Alex', 'Sam']),
    bill('2026-02-01', 'Sam', 20, ['Alex', 'Sam']),
  ]);
  assert.deepEqual(results.allResult.settlements, []);
  assert.deepEqual(results.monthlyResults.map(({ result }) => result.settlements), [
    [{ from: 'Alex', to: 'Sam', amount: 10 }],
    [{ from: 'Sam', to: 'Alex', amount: 10 }],
  ]);
});

test('splits pennies exactly and honours item recipients and bill participant fallback', () => {
  const results = buildSplitResults(participants, [
    bill('2026-02-01', 'Alex', 10),
    bill('2026-02-02', 'Sam', 5, ['Sam']),
    { ...bill('2026-02-03', 'Jo', 0.01, []), participants: ['Alex', 'Jo'] },
  ]);
  const { balances, total } = results.allResult;
  assert.equal(total, 15.01);
  assert.deepEqual(balances, { Alex: 6.65, Sam: -3.33, Jo: -3.32 });
  assert.equal(Object.values(balances).reduce((sum, amount) => sum + Math.round(amount * 100), 0), 0);
});

test('rebuilding after editing or deleting bills updates available months', () => {
  const trip = bill('2026-01-01', 'Alex', 30);
  assert.equal(buildSplitResults(participants, [trip]).monthlyResults[0].month, '2026-01');
  assert.equal(buildSplitResults(participants, [{ ...trip, date: '2026-02-01' }]).monthlyResults[0].month, '2026-02');
  const empty = buildSplitResults(participants, []);
  assert.deepEqual(empty.monthlyResults, []);
  assert.equal(empty.allResult.itemCount, 0);
  assert.deepEqual(empty.allResult.settlements, []);
});

test('undated bills remain in all-time results without creating invalid month options', () => {
  const results = buildSplitResults(participants, [bill('', 'Alex', 30), bill('2026-13-01', 'Sam', 60)]);
  assert.equal(results.allResult.total, 90);
  assert.deepEqual(results.monthlyResults, []);
});

test('assigns a backdated bill to its entered date rather than its save timestamp', () => {
  const results = buildSplitResults(participants, [{
    ...bill('2026-03-31', 'Alex', 30),
    created_at: '2026-10-25T12:00:00Z',
  }]);
  assert.equal(results.monthlyResults[0].month, '2026-03');
  assert.equal(results.monthlyResults[0].result.total, 30);
  assert.deepEqual(results.monthlyResults[0].result.settlements, [
    { from: 'Sam', to: 'Alex', amount: 10 },
    { from: 'Jo', to: 'Alex', amount: 10 },
  ]);
});
