const express = require('express');

const router = express.Router();

const User = require('../models/User'); 


router.post('/', async (req, res) => {  
  try {
    const { name, email, password, isVegetarian, drinksAlcohol } = req.body;


    // Basic validation : Mongoose's `required: true` will also catch this, but checking early
    // lets us send a clearer, faster error response.
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }


    const newUser = new User({
      name,
      email,
      password, // Reminder: plain-text for now — hash this with bcrypt before production
      isVegetarian,
      drinksAlcohol,
    });

    // .save() is what actually writes the document to MongoDB Atlas.
    // It's async because it's a network call to the database — hence `await`.
    const savedUser = await newUser.save();

    res.status(201).json(savedUser);

  } catch (error) {

    if (error.code === 11000) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }


    console.error(error);
    res.status(500).json({ message: 'Server error while creating user.' });
  }
});



router.get('/', async (req, res) => {
  try {
    // User.find({}) with an empty filter object means "match everything" —
    // i.e., fetch every document in the users collection.
    const users = await User.find({});

    res.status(200).json(users);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching users.' });
  }
});


module.exports = router;