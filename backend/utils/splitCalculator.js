function calculateSplit(lineItems, vegMembers, nonVegMembers, alcoholMembers) {
  vegMembers = vegMembers.map((id) => id.toString());
  nonVegMembers = nonVegMembers.map((id) => id.toString());
  alcoholMembers = alcoholMembers.map((id) => id.toString());

  const allMembers = [...new Set([...vegMembers, ...nonVegMembers, ...alcoholMembers])];

  const balances = {};
  allMembers.forEach((userId) => {
    balances[userId] = 0;
  });

  lineItems.forEach((item) => {
    let responsibleGroup;

    if (item.isAlcohol === true) {
      responsibleGroup = alcoholMembers;
    } else if (item.dietaryTag === 'veg') {
      responsibleGroup = vegMembers;
    } else if (item.dietaryTag === 'non-veg') {
      responsibleGroup = nonVegMembers;
    } else {
      responsibleGroup = allMembers;
    }

    if (!responsibleGroup || responsibleGroup.length === 0) {
      console.warn(`Skipping item "${item.itemName}" — no one assigned to split it.`);
      return;
    }

    // THE KEY CHANGE: the line's actual cost is unit price × quantity, not
    // just price alone. (item.quantity || 1) guards older saved expenses
    // from before this feature existed, which have no quantity field at
    // all — they'll correctly behave as quantity 1, i.e. unchanged math.
    const lineTotal = item.price * (item.quantity || 1);
    const splitAmount = lineTotal / responsibleGroup.length;

    responsibleGroup.forEach((userId) => {
      if (balances[userId] === undefined) {
        balances[userId] = 0;
      }
      balances[userId] += splitAmount;
    });
  });

  Object.keys(balances).forEach((userId) => {
    balances[userId] = Math.round(balances[userId] * 100) / 100;
  });

  return { balances, allMembers };
}

module.exports = calculateSplit;