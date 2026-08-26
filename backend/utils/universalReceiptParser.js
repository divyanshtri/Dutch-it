const { GoogleGenAI } = require('@google/genai');

const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const stringField = (description) => ({ type: 'string', description });
const numberField = (description) => ({ type: 'number', description });

const universalReceiptSchema = {
  type: 'object',
  properties: {
    merchant: {
      type: 'object',
      properties: {
        name: stringField('Merchant, seller, restaurant, or supplier name. Empty string if absent.'),
        address: stringField('Complete merchant address as printed. Empty string if absent.'),
        gstin: stringField('Merchant GSTIN exactly as printed. Empty string if absent.'),
        pan: stringField('Merchant PAN exactly as printed. Empty string if absent.'),
      },
      required: ['name', 'address', 'gstin', 'pan'],
    },
    invoiceDetails: {
      type: 'object',
      properties: {
        invoiceNumber: stringField('Invoice, bill, receipt, or document number. Empty string if absent.'),
        invoiceDate: stringField('Invoice date exactly as printed. Empty string if absent.'),
        dueDate: stringField('Payment due date exactly as printed. Empty string if absent.'),
        placeOfSupply: stringField('Place or state of supply exactly as printed. Empty string if absent.'),
      },
      required: ['invoiceNumber', 'invoiceDate', 'dueDate', 'placeOfSupply'],
    },
    customer: {
      type: 'object',
      properties: {
        name: stringField('Customer, buyer, billed-to, or shipped-to name. Empty string if absent.'),
        gstin: stringField('Customer GSTIN exactly as printed. Empty string if absent.'),
        address: stringField('Complete customer address as printed. Empty string if absent.'),
      },
      required: ['name', 'gstin', 'address'],
    },
    lineItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          srNo: numberField('Printed serial number; use the one-based row number if absent.'),
          description: stringField('Full item or service description.'),
          hsnSac: stringField('HSN or SAC code. Empty string if absent.'),
          quantity: numberField('Item quantity. Use 1 when absent.'),
          unit: stringField('Unit of measure as printed. Empty string if absent.'),
          listPrice: numberField('Unit/list price before discount. Use 0 if absent.'),
          discountPercent: numberField('Discount percentage. Use 0 if absent.'),
          taxPercent: numberField('Combined tax percentage applying to this row. Use 0 if absent.'),
          amount: numberField('Final printed line amount after discount and tax where the document presents it. Use 0 if absent.'),
        },
        required: ['srNo', 'description', 'hsnSac', 'quantity', 'unit', 'listPrice', 'discountPercent', 'taxPercent', 'amount'],
      },
    },
    totals: {
      type: 'object',
      properties: {
        subtotal: numberField('Subtotal before tax. Use 0 if absent.'),
        cgst: numberField('Total CGST amount. Use 0 if absent.'),
        sgst: numberField('Total SGST amount. Use 0 if absent.'),
        igst: numberField('Total IGST amount. Use 0 if absent.'),
        totalTax: numberField('Total tax amount. Use 0 if absent.'),
        grandTotal: numberField('Final payable total. Use 0 if absent.'),
        grandTotalInWords: stringField('Grand total in words exactly as printed. Empty string if absent.'),
      },
      required: ['subtotal', 'cgst', 'sgst', 'igst', 'totalTax', 'grandTotal', 'grandTotalInWords'],
    },
    paymentInfo: {
      type: 'object',
      properties: {
        bankName: stringField('Bank name. Empty string if absent.'),
        accountNumber: stringField('Bank account number exactly as printed. Empty string if absent.'),
        ifscCode: stringField('IFSC code exactly as printed. Empty string if absent.'),
        branch: stringField('Bank branch exactly as printed. Empty string if absent.'),
      },
      required: ['bankName', 'accountNumber', 'ifscCode', 'branch'],
    },
  },
  required: ['merchant', 'invoiceDetails', 'customer', 'lineItems', 'totals', 'paymentInfo'],
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(modelName, base64Image, mimeType) {
  return ai.models.generateContent({
    model: modelName,
    contents: [{
      role: 'user',
      parts: [
        {
          text:
            'Extract all visible structured data from this receipt or tax invoice. It may be a B2B GST invoice, retail bill, restaurant receipt, or another invoice format. Preserve identifiers and text exactly as printed. Do not infer GSTIN, PAN, bank details, dates, tax values, or totals that are not visible. Use empty strings or numeric zero for missing fields as required by the schema. Capture every genuine product or service row in reading order. Return only the schema-conforming JSON result.',
        },
        { inlineData: { mimeType, data: base64Image } },
      ],
    }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: universalReceiptSchema,
    },
  });
}

async function parseUniversalReceipt(imageBuffer, mimeType) {
  const base64Image = imageBuffer.toString('base64');
  const models = [...new Set([PRIMARY_MODEL, FALLBACK_MODEL])];

  for (const modelName of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await callGemini(modelName, base64Image, mimeType);
        return JSON.parse(response.text);
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
