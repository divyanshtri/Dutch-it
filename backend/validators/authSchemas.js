const { z } = require('zod');

const registerSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(100),
  email: z.string().trim().email('Invalid email address').max(254),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number format'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  isVegetarian: z.boolean().optional(),
  drinksAlcohol: z.boolean().optional(),
  photoURL: z.string().nullable().optional(),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Email or phone number is required').max(254),
  password: z.string().min(1, 'Password is required').max(128),
});

module.exports = { registerSchema, loginSchema };