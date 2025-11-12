// controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Register user (PUBLIC) — never allow admin here
const registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'Email already exists' });

    // Force safe roles (default student). Admin creation is only via admin routes.
    const safeRole = ['student', 'parent', 'teacher'].includes(role) ? role : 'student';

    const newUser = new User({ name, email, password, role: safeRole });
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Login user — also return user profile for the frontend
const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // Optional: block deactivated accounts
    if (user.isActive === false) {
      return res.status(403).json({ message: 'Account is disabled. Contact admin.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Optional: last login stamp
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const { password: _, __v, ...safeUser } = user.toObject();
    res.json({ token, user: safeUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { registerUser, loginUser, getCurrentUser };
