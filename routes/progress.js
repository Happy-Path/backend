// backend/routes/progress.js
const express = require("express");
const Progress = require("../models/Progress");
const { protect } = require("../middleware/authMiddleware");
const roleGuard = require("../middleware/roleGuard");
const {
    parentCanAccessStudent,
} = require("../controllers/parentStudentAssignmentController");

const router = express.Router();
router.use(protect);

// Helper: ACL for routes that read progress by userId
async function ensureProgressAccess(req, res, userId) {
    const meId = req.user._id.toString();
    const role = req.user.role;

    // Student: can only access their own data
    if (role === "student" && meId !== userId) {
        res.status(403).json({ message: "Not authorized" });
        return false;
    }

    // Parent: only assigned children
    if (role === "parent") {
        const allowed = await parentCanAccessStudent(meId, userId);
        if (!allowed) {
            res
                .status(403)
                .json({ message: "Not authorized for this child" });
            return false;
        }
    }

    // Teacher: allowed for any user
    return true;
}

// Upsert a progress ping (student)
router.post("/ping", roleGuard(["student"]), async (req, res) => {
    try {
        const {
            lessonId,
            positionSec = 0,
            durationSec = 0,
            completed = false,
        } = req.body || {};
        if (!lessonId)
            return res
                .status(400)
                .json({ message: "lessonId is required" });

        const clamp = (n, min, max) =>
            Math.max(min, Math.min(max, n || 0));
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
                    lastPingAt: new Date(),
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.json(doc);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// List progress for a user (student/parent/teacher)
router.get(
    "/user/:userId",
    roleGuard(["student", "parent", "teacher"]),
    async (req, res) => {
        try {
            const userId = req.params.userId;

            const ok = await ensureProgressAccess(req, res, userId);
            if (!ok) return;

            const items = await Progress.find({ userId }).lean();
            res.json(items);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    }
);

// Single item
router.get(
    "/user/:userId/lesson/:lessonId",
    roleGuard(["student", "parent", "teacher"]),
    async (req, res) => {
        try {
            const userId = req.params.userId;
            const lessonId = req.params.lessonId;

            const ok = await ensureProgressAccess(req, res, userId);
            if (!ok) return;

            const item = await Progress.findOne({
                userId,
                lessonId,
            }).lean();
            res.json(item || null);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    }
);

module.exports = router;
