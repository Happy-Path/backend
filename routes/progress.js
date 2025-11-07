// backend/routes/progress.js
const express = require("express");
const Progress = require("../models/Progress");
const { protect } = require("../middleware/authMiddleware");
const roleGuard = require("../middleware/roleGuard");

const router = express.Router();
router.use(protect);

// Upsert a progress ping (student)
router.post("/ping", roleGuard(["student"]), async (req, res) => {
    try {
        const { lessonId, positionSec = 0, durationSec = 0, completed = false } = req.body || {};
        if (!lessonId) return res.status(400).json({ message: "lessonId is required" });

        const clamp = (n, min, max) => Math.max(min, Math.min(max, n || 0));
        const dur = clamp(durationSec, 0, 24 * 3600);
        const pos = clamp(positionSec, 0, dur || 24 * 3600);
        const pct = dur ? Math.round((pos / dur) * 100) : 0;
        const isDone = completed || pct >= 95;

        const doc = await Progress.findOneAndUpdate(
            { userId: req.user.id, lessonId },
            {
                $set: {
                    durationSec: Math.max(dur, 0),
                    positionSec: Math.max(pos, 0),
                    percent: Math.min(100, Math.max(pct, 0)),
                    completed: isDone,
                    lastPingAt: new Date()
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.json(doc);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// List progress for a user (student/parent/teacher)
router.get("/user/:userId", roleGuard(["student","parent","teacher"]), async (req, res) => {
    try {
        const items = await Progress.find({ userId: req.params.userId }).lean();
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Single item
router.get("/user/:userId/lesson/:lessonId", roleGuard(["student","parent","teacher"]), async (req, res) => {
    try {
        const item = await Progress.findOne({
            userId: req.params.userId,
            lessonId: req.params.lessonId
        }).lean();
        res.json(item || null);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
