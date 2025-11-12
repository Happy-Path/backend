// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/authMiddleware');

// GET /api/users?role=parent|teacher&q=search&limit=20
router.get('/', protect, requireRole('teacher', 'parent', 'admin'), async (req, res) => {
    const { role, q, limit = 20 } = req.query;

    const filter = {};
    if (role) filter.role = role; // only list one role if provided
    if (q) {
        filter.$or = [
            { name:  { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
        ];
    }

    const users = await User.find(filter)
        .select('_id name email role')
        .sort({ name: 1 })
        .limit(Number(limit));

    res.json(users);
});

module.exports = router;
