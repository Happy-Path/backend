// routes/authRoutes.js
const express = require('express');
const { registerUser, loginUser, getCurrentUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

// Auth routes
router.post('/register', registerUser); // Registration route
router.post('/login', loginUser);       // Login route

// Protected route (optional)
router.get('/me', protect, getCurrentUser);

module.exports = router;

