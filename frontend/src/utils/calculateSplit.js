export function calculateSplit(lineItems, vegMembers, nonVegMembers, alcoholMembers) {
  const allMembers = [...new Set([...vegMembers, ...nonVegMembers, ...alcoholMembers])];

  const balances = {};
  allMembers.forEach((id) => {
    balances[id] = 0;
  });

  lineItems.forEach((item) => {
    const price = parseFloat(item.price);
    const quantity = parseInt(item.quantity) || 1;
    if (!price || price <= 0) return;

    let responsibleGroup;
    if (item.isAlcohol) {
      responsibleGroup = alcoholMembers;
    } else if (item.dietaryTag === 'veg') {
      responsibleGroup = vegMembers;
    } else if (item.dietaryTag === 'non-veg') {
      responsibleGroup = nonVegMembers;
    } else {
      responsibleGroup = allMembers;
    }

    if (!responsibleGroup || responsibleGroup.length === 0) return;

    // Same fix as the backend copy: split the FULL line cost (unit × qty).
    const lineTotal = price * quantity;
    const splitAmount = lineTotal / responsibleGroup.length;
    responsibleGroup.forEach((id) => {
      balances[id] = (balances[id] || 0) + splitAmount;
    });
  });

  Object.keys(balances).forEach((id) => {
    balances[id] = Math.round(balances[id] * 100) / 100;
  });

  return { balances, allMembers };
}