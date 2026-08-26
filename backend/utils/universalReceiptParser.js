const { GoogleGenAI } = require('@google/genai');

const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const EXTRACTION_PROMPT = `Analyze the provided image of a receipt/invoice. Perform a complete, non-lossy extraction of ALL information visible on the document. Do not drop, omit, or misassign any field.

Return a pure JSON object structured dynamically as follows:
{
  "documentType": "String (e.g., Tax Invoice, Thermal Receipt, Hand-written Bill, Purchase Order)",
  "headersAndMetadata": {
    "<every visible header, metadata, seller, buyer, billing, shipping, and document field using its printed label>": "value"
  },
  "lineItems": [
    {
      "<each table column header exactly as detected>": "cell value"
    }
  ],
  "totalsAndTaxBreakdown": {
    "<every visible subtotal, tax, cess, charge, discount, total, and amount-in-words label>": "value"
  },
  "additionalSections": {
    "<every remaining named section such as bank/payment details, terms, remarks, declarations, signatures, or custom footers>": "value or nested object"
  },
  "unclassifiedData": [
    "Any visible text that does not fit the categories above"
  ]
}

Dynamically extract EVERY key-value pair found in header, metadata, seller, customer, billing, shipping, or other document sections, including custom fields such as Invoice No, Date, Due Date, GSTIN, PAN, Place of Supply, Vehicle No, PO No, and Customer Name. Extract every row and every column from every items table. Use the printed table column labels as the JSON keys for each row; do not restrict them to common invoice columns. Capture all tax types, subtotals, totals, totals in words, extra charges, and discounts. Preserve nested relationships for additional sections. If the document contains multiple tables or sections that do not fit lineItems, retain them under additionalSections with descriptive dynamic keys. Put every remaining visible text fragment in unclassifiedData so no information is silently discarded.

Ensure all numerical values are converted to JSON numbers where appropriate, while identifiers that can contain leading zeroes or formatting (invoice numbers, GSTIN, PAN, phone numbers, account numbers, HSN/SAC, postal codes, dates, percentages printed with symbols, and similar codes) remain clean strings. Keep printed labels as keys whenever possible. Do not invent missing content. Do not include markdown formatting or prose wrappers.`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(modelName, base64Image, mimeType) {
  return ai.models.generateContent({
    model: modelName,
    contents: [{
      role: 'user',
      parts: [
        { text: EXTRACTION_PROMPT },
        { inlineData: { mimeType, data: base64Image } },
      ],
    }],
    config: { responseMimeType: 'application/json' },
  });
}

async function parseUniversalReceipt(imageBuffer, mimeType) {
  const base64Image = imageBuffer.toString('base64');
  const models = [...new Set([PRIMARY_MODEL, FALLBACK_MODEL])];

  for (const modelName of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await callGemini(modelName, base64Image, mimeType);
        const parsed = JSON.parse(response.text);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
          throw new Error('Gemini returned an invalid document structure.');
        }
        return parsed;
      } catch (error) {
        const status = error.status || error.code;
        const retryable = status === 429 || status === 503 || /\b(429|503)\b/.test(error.message || '');
        if (status === 404) break;
        if (!retryable) {
          console.error(`Universal receipt parsing failed on ${modelName}:`, error);
          throw new Error('Could not parse this document. Try a clearer, well-lit image.');
        }
        if (attempt < 2) await sleep(1000 * attempt);
      }
    }
  }

  throw new Error('The document parser is temporarily unavailable. Please try again in a few minutes.');
}

module.exports = parseUniversalReceipt;
