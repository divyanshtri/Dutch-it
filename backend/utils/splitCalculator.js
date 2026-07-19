function calculateSplit(lineItems, vegMembers, nonVegMembers, alcoholMembers) {
  // ----- NORMALIZE ALL IDs TO STRINGS FIRST -----
  // Mongoose ObjectIds are objects, not primitive strings. Two ObjectId
  // instances can represent the exact same ID yet fail === comparisons and
  // fail Set-based deduplication, because JS compares objects by reference,
  // not by value. Converting everything to strings up front means every
  // comparison, Set operation, and object-key lookup below behaves correctly,
  // whether this function was called with raw strings (from a Postman body)
  // or Mongoose ObjectId objects (from a saved document, like in /balances).
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

    const splitAmount = item.price / responsibleGroup.length;

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