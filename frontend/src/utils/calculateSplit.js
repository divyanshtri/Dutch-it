// This mirrors backend/utils/splitCalculator.js almost exactly. Keeping the
// SAME logic in two places (browser + server) is a normal, necessary
// tradeoff for a live preview — the frontend calculates instantly for
// display, but the backend is still the source of truth that actually
// gets saved. If the two ever disagree, the backend always wins.
export function calculateSplit(lineItems, vegMembers, nonVegMembers, alcoholMembers) {
  const allMembers = [...new Set([...vegMembers, ...nonVegMembers, ...alcoholMembers])];

  const balances = {};
  allMembers.forEach((id) => {
    balances[id] = 0;
  });

  lineItems.forEach((item) => {
    const price = parseFloat(item.price);
    if (!price || price <= 0) return; // skip incomplete rows while user is still typing

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

    const splitAmount = price / responsibleGroup.length;
    responsibleGroup.forEach((id) => {
      balances[id] = (balances[id] || 0) + splitAmount;
    });
  });

  Object.keys(balances).forEach((id) => {
    balances[id] = Math.round(balances[id] * 100) / 100;
  });

  return { balances, allMembers };
}