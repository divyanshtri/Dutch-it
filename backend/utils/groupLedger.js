const calculateSplit = require('./splitCalculator');

function calculateGroupBalances(expenses, settlements) {
  const ledger = {};

  function addDebt(debtorId, creditorId, amount) {
    if (!ledger[debtorId]) ledger[debtorId] = {};
    ledger[debtorId][creditorId] = (ledger[debtorId][creditorId] || 0) + amount;
  }

  expenses.forEach((expense) => {
    const payerId = expense.paidBy._id?.toString() || expense.paidBy.toString();
    if (expense.splitType && expense.splitType !== 'itemized') {
      expense.splits.forEach((split) => {
        const userId = split.user._id?.toString() || split.user.toString();
        if (userId !== payerId) addDebt(userId, payerId, split.amount);
      });
      return;
    }

    const { balances } = calculateSplit(
      expense.lineItems,
      expense.vegMembers,
      expense.nonVegMembers,
      expense.alcoholMembers
    );
    Object.entries(balances).forEach(([userId, amount]) => {
      if (userId !== payerId) addDebt(userId, payerId, amount);
    });
  });

  settlements.forEach((settlement) => {
    const payerId = settlement.payer._id?.toString() || settlement.payer.toString();
    const receiverId = settlement.receiver._id?.toString() || settlement.receiver.toString();
    addDebt(payerId, receiverId, -settlement.amount);
  });

  const balances = [];
  const processedPairs = new Set();
  Object.entries(ledger).forEach(([debtorId, creditors]) => {
    Object.keys(creditors).forEach((creditorId) => {
      const pairKey = [debtorId, creditorId].sort().join('_');
      if (processedPairs.has(pairKey)) return;
      processedPairs.add(pairKey);
      const net = (ledger[debtorId]?.[creditorId] || 0) - (ledger[creditorId]?.[debtorId] || 0);
      if (Math.abs(net) < 0.01) return;
      balances.push(net > 0
        ? { owes: debtorId, owedTo: creditorId, amount: Math.round(net * 100) / 100 }
        : { owes: creditorId, owedTo: debtorId, amount: Math.round(Math.abs(net) * 100) / 100 });
    });
  });

  return balances;
}

module.exports = calculateGroupBalances;
