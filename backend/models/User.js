const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true, 
      trim: true,      
    },
    email: {
      type: String,
      required: true,
      unique: true,   
      lowercase: true, 
      trim: true,
    },
    password: {
      type: String,
      required: true,
      // NOTE: Never store plain-text passwords. When you build your auth routes,
      // you'll hash this with bcrypt BEFORE saving it here. The schema itself
      // doesn't know or care that it's hashed — it just stores whatever string it's given.
    },


    isVegetarian: {
      type: Boolean,
      default: false,
    },
    drinksAlcohol: {
      type: Boolean,
      default: false,
    },
  },
  {

    timestamps: true,
    strict: 'throw',
    // Normally, Mongoose's default strict mode just SILENTLY DROPS any field
    // in the request body that isn't defined in the schema. Setting this to
    // 'throw' changes that behavior: if req.body contains a key that doesn't
    // exist in the schema (a typo, or a frontend bug), Mongoose will throw a
    // StrictModeError instead of quietly ignoring it. This trades a small
    // amount of flexibility for catching bugs immediately instead of silently
    // computing wrong numbers — exactly what bit you with `tag` vs `dietaryTag`.
  }
);


module.exports = mongoose.model('User', userSchema);