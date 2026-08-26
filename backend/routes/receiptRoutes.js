const express = require('express');
const multer = require('multer');
const { fileTypeFromBuffer } = require('file-type');
const router = express.Router();

const parseReceiptImage = require('../utils/receiptParser');
const parseUniversalReceipt = require('../utils/universalReceiptParser');
const protect = require('../middleware/authMiddleware');
const { actionLimiter } = require('../middleware/rateLimiters');

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
function normalizeDietaryTag(tag) {
  return tag === 'vegan' ? 'veg' : tag;
}

// ----- QUANTITY NORMALIZATION -----
function normalizeQuantity(qty) {
  return qty && qty > 0 ? qty : 1;
}

router.post('/scan', upload.single('receipt'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No receipt image was uploaded.' });
    }

    // Inspect the actual file signature (magic bytes) to prevent MIME-type header spoofing
    const detectedType = await fileTypeFromBuffer(req.file.buffer);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!detectedType || !allowedTypes.includes(detectedType.mime)) {
      return res.status(400).json({ message: 'File does not appear to be a valid image.' });
    }

    const parsedReceipt = await parseReceiptImage(req.file.buffer, detectedType.mime);

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
    next(error);
  }
});

// Temporary universal document parser. Kept separate from the dietary receipt flow.
router.post(
  '/parse-universal',
  protect,
  actionLimiter,
  upload.single('receipt'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No receipt or invoice image was uploaded.' });
      }

      const detectedType = await fileTypeFromBuffer(req.file.buffer);
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!detectedType || !allowedTypes.includes(detectedType.mime)) {
        return res.status(400).json({ message: 'Upload a valid JPEG, PNG, or WEBP image.' });
      }

      const document = await parseUniversalReceipt(req.file.buffer, detectedType.mime);
      return res.status(200).json({ document });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
