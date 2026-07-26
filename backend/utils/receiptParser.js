const { GoogleGenAI } = require('@google/genai');

const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash-lite';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const receiptSchema = {
  type: 'object',
  properties: {
    merchantName: {
      type: 'string',
      description: 'The name of the restaurant or store on the receipt. Use "Unknown" if unreadable.',
    },
    lineItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          itemName: { type: 'string' },
          price: {
            type: 'number',
            description:
              'The UNIT price of a single one of this item — not the extended/line total. ' +
              'If the receipt shows a "Price" column and a separate "Total" column for a row ' +
              '(e.g. Price 340.00, Qty 2.000, Total 680.00), use the PRICE column value here (340), ' +
              'not the Total column value.',
          },
          quantity: {
            type: 'number',
            description:
              'How many of this item were ordered, taken from the receipt\'s Qty column. ' +
              'Default to 1 if the receipt has no quantity column at all.',
          },
          dietaryTag: {
            type: 'string',
            enum: ['veg', 'non-veg', 'vegan', 'neutral'],
            description:
              'Classify based on the actual ingredients implied by the item name. ' +
              'Meat, poultry, seafood, or fish (chicken, mutton, prawns, fish, egg dishes) → "non-veg". ' +
              'Plant-based dishes with no animal products at all (vegetables, legumes, tofu, plant milks) → "vegan". ' +
              'Vegetarian dishes that may include dairy/paneer/cheese but no meat, fish, or egg → "veg". ' +
              'Anything that is not a food item at all — drinks (non-alcoholic), tax, service charge, ' +
              'or anything where dietary classification doesn\'t apply → "neutral".',
          },
          isAlcohol: {
            type: 'boolean',
            description:
              'True if the item name implies an alcoholic beverage — beer, wine, cocktails, spirits, ' +
              'or drink names that imply alcohol by convention (e.g. "Mojito", "Long Island", "Sangria", ' +
              '"Old Fashioned"). False for non-alcoholic drinks, food, tax, or charges.',
          },
        },
        required: ['itemName', 'price', 'quantity', 'dietaryTag', 'isAlcohol'],
      },
    },
    tax: {
      type: 'number',
      description:
        'Kept for backward compatibility — set this to 0. All tax, VAT, service tax, and ' +
        'service charge amounts should instead be appended as their own entries in lineItems (see instructions).',
    },
    total: {
      type: 'number',
      description: 'The final total amount on the receipt (e.g. "Net Amount" or "Grand Total").',
    },
  },
  required: ['merchantName', 'lineItems', 'tax', 'total'],
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(modelName, base64Image, mimeType) {
  return ai.models.generateContent({
    model: modelName,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              'Extract every line item from this receipt with its name, UNIT price, and quantity ' +
              '(follow the price/quantity distinction defined in the schema exactly — do not confuse ' +
              'a unit price with an extended line total). For each food/drink item, classify its dietary ' +
              'category and whether it is alcoholic, following the schema\'s classification rules. ' +
              '\n\n' +
              'Additionally: look at the bottom of the receipt for any VAT, tax, service tax, or service ' +
              'charge lines — these are often shown as a percentage (e.g. "VAT 5.5%", "Service Charges 10.00%") ' +
              'next to a calculated amount. Append EACH of these as its own separate entry in the lineItems ' +
              'array, using a descriptive name that includes the original label and rate exactly as printed ' +
              '(e.g. "VAT 5.5%", "Service Tax 5.6%"), using the calculated amount shown as its price, with ' +
              'quantity 1, dietaryTag "neutral", and isAlcohol false. Do this for every distinct tax/charge ' +
              'line — a receipt commonly has more than one (e.g. two different VAT rates plus a service charge).' +
              '\n\n' +
              'Extract the merchant name and the final total/net amount. Set "tax" to 0 always, since tax ' +
              'lines now live inside lineItems instead. If a value is unreadable or missing, use a sensible ' +
              'default rather than guessing wildly.',
          },
          {
            inlineData: { mimeType, data: base64Image },
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: receiptSchema,
    },
  });
}

async function parseReceiptImage(imageBuffer, mimeType) {
  const base64Image = imageBuffer.toString('base64');
  const maxAttemptsPerModel = 2;

  // Outer loop: Try primary model (gemini-3.5-flash) first, then fallback model (gemini-2.5-flash-lite)
  for (const modelName of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
      try {
        const response = await callGemini(modelName, base64Image, mimeType);
        const parsed = JSON.parse(response.text);
        console.log(`Receipt parsed successfully using ${modelName}`);
        return parsed;
      } catch (error) {
        const isRetryable =
          error.status === 503 ||
          error.status === 429 ||
          error.message?.includes('503') ||
          error.message?.includes('429');

        const isLastAttemptForThisModel = attempt === maxAttemptsPerModel;

        if (!isRetryable) {
          console.error(`Gemini failed on ${modelName} (non-retryable):`, error);
          throw new Error('Could not read this receipt. Try a clearer photo or enter items manually.');
        }

        if (isLastAttemptForThisModel) {
          console.warn(`${modelName} overloaded after ${maxAttemptsPerModel} attempts, switching to fallback model...`);
          break; // Exit inner loop and try the fallback model
        }

        const waitMs = 1000 * attempt;
        console.warn(`${modelName} overloaded (attempt ${attempt}/${maxAttemptsPerModel}), retrying in ${waitMs}ms...`);
        await sleep(waitMs);
      }
    }
  }

  console.error('Gemini receipt parsing failed on both primary and fallback models.');
  throw new Error("Could not read this receipt right now — Google's AI service is experiencing heavy demand. Try again in a few minutes, or enter items manually.");
}

module.exports = parseReceiptImage;