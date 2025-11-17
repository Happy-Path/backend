// routes/teacher.js
const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/authMiddleware");
const roleGuard = require("../middleware/roleGuard");
const Session = require("../models/Session");

const router = express.Router();
router.use(protect);

// Distinct students derived from recent sessions (fallback without User model)
router.get("/students", roleGuard(["teacher"]), async (req, res) => {
    try {
        const { days = 90 } = req.query;
        const since = new Date(Date.now() - Number(days) * 24 * 3600 * 1000);

        const agg = await Session.aggregate([
            { $match: { startedAt: { $gte: since } } },
            { $group: { _id: "$userId", lastSession: { $max: "$startedAt" } } },
            // Try to join to 'users' collection to get a name/email if available
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
            { $project: {
                    userId: "$_id",
                    lastSession: 1,
                    name: { $ifNull: [ { $arrayElemAt: ["$user.name", 0] }, null ] },
                    email: { $ifNull: [ { $arrayElemAt: ["$user.email", 0] }, null ] },
                    role: { $ifNull: [ { $arrayElemAt: ["$user.role", 0] }, null ] }
                }
            },
            { $sort: { lastSession: -1 } }
        ]);

        res.json(agg.map(x => ({
            userId: x.userId?.toString(),
            display: x.name || x.email || x.userId?.toString(),
            lastSession: x.lastSession,
            role: x.role || null
        })));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
