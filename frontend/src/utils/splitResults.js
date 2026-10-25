// Calculate every scope from its bills so payments in other months never offset it.
export const calculateSplit = (participants, trips) => {
  const balances = new Map(participants.map((name) => [name, 0]));
  let total = 0;
  let itemCount = 0;

  trips.forEach((trip) => {
    (trip.items || []).forEach((item) => {
      const amount = Math.round(Number(item.price) * 100);
      const people = [...new Set(item.splitBetween?.length ? item.splitBetween : trip.participants || [])];
      if (!Number.isFinite(amount) || amount <= 0 || !item.paidBy || people.length === 0) return;

      balances.set(item.paidBy, (balances.get(item.paidBy) || 0) + amount);
      const share = Math.floor(amount / people.length);
      const remainder = amount % people.length;
      people.forEach((name, index) => {
        balances.set(name, (balances.get(name) || 0) - share - (index < remainder ? 1 : 0));
      });
      total += amount;
      itemCount += 1;
    });
  });

  const creditors = [...balances].filter(([, amount]) => amount > 0).map(([name, amount]) => ({ name, amount }));
  const debtors = [...balances].filter(([, amount]) => amount < 0).map(([name, amount]) => ({ name, amount: -amount }));
  const settlements = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.amount, debtor.amount);
    settlements.push({ from: debtor.name, to: creditor.name, amount: amount / 100 });
    creditor.amount -= amount;
    debtor.amount -= amount;
    if (creditor.amount === 0) creditorIndex += 1;
    if (debtor.amount === 0) debtorIndex += 1;
  }

  return {
    participants: [...balances.keys()],
    balances: Object.fromEntries([...balances].map(([name, amount]) => [name, amount / 100])),
    settlements,
    total: total / 100,
    tripCount: trips.length,
    itemCount,
  };
};

export const buildSplitResults = (participants, trips) => {
  const tripsByMonth = new Map();
  trips.forEach((trip) => {
    // Use the bill's calendar date directly, without timezone conversion.
    const month = String(trip.date || '').match(/^(\d{4}-(?:0[1-9]|1[0-2]))-\d{2}$/)?.[1];
    if (!month) return;
    if (!tripsByMonth.has(month)) tripsByMonth.set(month, []);
    tripsByMonth.get(month).push(trip);
  });

  return {
    allResult: calculateSplit(participants, trips),
    monthlyResults: [...tripsByMonth.keys()].sort().reverse().map((month) => ({
      month,
      result: calculateSplit(participants, tripsByMonth.get(month)),
    })),
  };
};
