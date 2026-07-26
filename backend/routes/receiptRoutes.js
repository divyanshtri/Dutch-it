const express = require('express');
const multer = require('multer');
const router = express.Router();

const parseReceiptImage = require('../utils/receiptParser');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  },
});

// ----- DIETARY NORMALIZATION: vegan -> veg -----
// Gemini reasons with FOUR dietary categories for better classification
// accuracy. But our Expense schema and splitting logic only know about
// three categories: 'veg', 'non-veg', 'neutral'. We fold 'vegan' into
// 'veg' right here, at the boundary where AI output enters our system.
function normalizeDietaryTag(tag) {
  return tag === 'vegan' ? 'veg' : tag;
}

// ----- QUANTITY NORMALIZATION -----
// Defensive fallback even though the schema marks quantity as required —
// belt-and-suspenders in case Gemini ever returns 0 or a null for an edge
// case row. A quantity of 0 would make price * quantity always zero, so
// we guard it here to default safely to 1.
function normalizeQuantity(qty) {
  return qty && qty > 0 ? qty : 1;
}

router.post('/scan', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No receipt image was uploaded.' });
    }

    const { buffer, mimetype } = req.file;
    const parsedReceipt = await parseReceiptImage(buffer, mimetype);

    // Apply both dietary and quantity normalization to every line item 
    // before this ever reaches the frontend.
    const normalizedReceipt = {
      ...parsedReceipt,
      lineItems: parsedReceipt.lineItems.map((item) => ({
        ...item,
        dietaryTag: normalizeDietaryTag(item.dietaryTag),
        quantity: normalizeQuantity(item.quantity),
      })),
    };

    res.status(200).json({ receipt: normalizedReceipt });

  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to process receipt.' });
  }
});

module.exports = router;