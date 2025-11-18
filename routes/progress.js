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
            res.status(403).json({ message: "Not authorized for this child" });
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

        if (!lessonId) {
            return res.status(400).json({ message: "lessonId is required" });
        }

        const clamp = (n, min, max) => Math.max(min, Math.min(max, n || 0));
        const userId = req.user.id;

        // Incoming values from client
        const incomingDur = clamp(durationSec, 0, 24 * 3600);
        const incomingPos = clamp(positionSec, 0, incomingDur || 24 * 3600);

        // Load existing progress (if any) to keep "furthest" watch position
        const existing = await Progress.findOne({ userId, lessonId });

        let dur = incomingDur;
        let pos = incomingPos;
        let prevPercent = 0;
        let prevCompleted = false;

        if (existing) {
            // keep the longest known duration (in case early pings had 0 duration)
            dur = Math.max(existing.durationSec || 0, incomingDur);

            // If duration is still 0 but the existing doc had a value, use that
            if (!dur && existing.durationSec) {
                dur = existing.durationSec;
            }

            // keep the furthest position the student has ever reached
            pos = Math.max(existing.positionSec || 0, incomingPos);

            prevPercent = existing.percent || 0;
            prevCompleted = !!existing.completed;
        }

        // Recalculate percent based on furthest position & best duration
        let pct = dur ? Math.round((pos / dur) * 100) : 0;

        // Never let percent go backwards
        pct = Math.min(100, Math.max(pct, prevPercent));

        // Completion logic
        let isDone = prevCompleted || completed || pct >= 95;

        if (isDone) {
            // Once we consider it "done", treat as fully complete
            isDone = true;
            pct = 100;

            // If duration is known, we can snap position to full duration
            if (dur) {
                pos = Math.max(pos, dur);
            }
        }

        let doc;
        if (!existing) {
            // Create new record
            doc = await Progress.create({
                userId,
                lessonId,
                durationSec: dur,
                positionSec: pos,
                percent: pct,
                completed: isDone,
                lastPingAt: new Date(),
            });
        } else {
            // Update existing record
            existing.durationSec = dur;
            existing.positionSec = pos;
            existing.percent = pct;
            existing.completed = isDone;
            existing.lastPingAt = new Date();
            doc = await existing.save();
        }

        res.json(doc);
    } catch (err) {
        console.error("Progress ping failed:", err);
        res.status(500).json({ message: err.message });
    }
});

// ✅ NEW: get progress for the currently logged-in student
router.get(
    "/me",
    roleGuard(["student"]),
    async (req, res) => {
        try {
            const userId = req.user.id;
            const items = await Progress.find({ userId }).lean();
            res.json(items);
        } catch (err) {
            console.error("Get /progress/me failed:", err);
            res.status(500).json({ message: err.message });
        }
    }
);

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
