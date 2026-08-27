const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required() { return !this.isGhost; },
      lowercase: true,
      trim: true,
      // Basic shape validation — not exhaustive RFC 5322 compliance (nothing
      // is), but catches obvious garbage input before it hits the database.
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address.'],
    },
    phoneNumber: {
      type: String,
      required() { return !this.isGhost; },
      trim: true,
      // Accepts an optional leading + and 7-15 digits — deliberately loose
      // since phone formats vary hugely by country, and you're building a
      // "search by phone" feature later, not payment/SMS integration where
      // strict E.164 formatting would matter more.
      match: [/^\+?[0-9]{7,15}$/, 'Please provide a valid phone number.'],
    },
    password: {
      type: String,
      required() { return !this.isGhost; },
      minlength: 8,
      // select: false means this field is EXCLUDED from query results by
      // default — e.g. User.find() will never return password hashes,
      // even accidentally. You have to explicitly opt in with
      // .select('+password') on the rare query that actually needs it
      // (like login, below). This is a strong default-safe pattern: it's
      // much harder to accidentally leak a password hash to the frontend
      // if the schema itself refuses to return it unless asked.
      select: false,
    },
    photoURL: {
      type: String,
      default: null,
    },


    // ----- FRIENDS LIST -----
    // Stores array of User ObjectIds to support friend additions and populate operations
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // ----- EXISTING FIELDS, PRESERVED -----
    isVegetarian: {
      type: Boolean,
      default: false,
    },
    drinksAlcohol: {
      type: Boolean,
      default: false,
    },
    isGhost: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    strict: 'throw',
  }
);

// ----- INDEXES -----
// email and phoneNumber already get a unique index automatically from
// `unique: true` above. This one is new: a text index across fullName,
// email, and phoneNumber together, specifically for the future "Find
// Friends" search feature. A text index lets MongoDB do fast, relevance-
// ranked substring/keyword search across multiple fields in one query,
// rather than you writing three separate regex queries and merging results
// yourself — regex scans are slow at scale, text indexes are built for this.
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phoneNumber: 1 }, { unique: true, sparse: true });
userSchema.index({ fullName: 'text', email: 'text', phoneNumber: 'text' });

// ----- PASSWORD HASHING: PRE-SAVE HOOK -----
// NOTE: this hook is `async` and takes NO `next` parameter. In current
// Mongoose, when a pre-hook is async, Mongoose automatically waits for the
// returned Promise to resolve before proceeding — it does NOT expect you
// to also call a next() callback. Declaring next as a parameter but never
// receiving a real function for it (as happened above) throws exactly the
// TypeError you hit. The fix is simply: don't ask for next, don't call it,
// just let the async function finish (or throw, which Mongoose also
// catches automatically and turns into a rejected save()).
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) {
    return; // returning early is enough — no next() needed
  }

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  // no next() call at the end either — the function just completes
});

// ----- INSTANCE METHOD: comparePassword -----
// Attached to every User document, so anywhere you have a `user` object
// you can call user.comparePassword(plainTextAttempt) directly.
userSchema.methods.comparePassword = async function (candidatePassword) {
  // bcrypt.compare hashes the candidate with the SAME salt stored in
  // this.password and checks if the results match — it never "decrypts"
  // the stored hash, because bcrypt hashing isn't reversible by design.
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
