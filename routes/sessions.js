// backend/routes/sessions.js
const express = require("express");
const Session = require("../models/Session");
const Event = require("../models/Event");
const { protect } = require("../middleware/authMiddleware");
const roleGuard = require("../middleware/roleGuard");
const {
    parentCanAccessStudent,
} = require("../controllers/parentStudentAssignmentController");

const router = express.Router();
router.use(protect);

// Helper: ACL for routes that read sessions by userId
async function ensureSessionUserAccess(req, res, userId) {
    const meId = req.user._id.toString();
    const role = req.user.role;

    // Student: only self
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

    // Teacher: any
    return true;
}

// Start a session (student only)
router.post("/", roleGuard(["student"]), async (req, res) => {
    try {
        const session = await Session.create({
            userId: req.user.id,
            lessonId: req.body.lessonId,
            deviceInfo: req.body.deviceInfo,
        });
        res.json(session);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// End session
router.post("/:id/end", roleGuard(["student"]), async (req, res) => {
    try {
        const s = await Session.findByIdAndUpdate(
            req.params.id,
            { endedAt: new Date() },
            { new: true }
        );
        res.json(s);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Ingest events (single or array)
router.post("/:id/events", roleGuard(["student"]), async (req, res) => {
    try {
        const payload = Array.isArray(req.body) ? req.body : [req.body];
        const docs = payload.map((e) => ({
            sessionId: req.params.id,
            ts: e.ts ? new Date(e.ts) : new Date(),
            type: e.type,
            emotion: e.emotion
                ? {
                    label: e.emotion.label || e.emotion,
                    scores: e.emotion.scores,
                }
                : undefined,
            attention: e.attention
                ? { score: e.attention.score, signals: e.attention.signals }
                : e.attentionScore != null
                    ? { score: e.attentionScore }
                    : undefined,
            latencyMs: e.metadata?.latencyMs,
        }));
        await Event.insertMany(docs);
        res.json({ inserted: docs.length });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// List sessions for a specific user (teacher/parent/student)
router.get(
    "/user/:userId",
    roleGuard(["teacher", "parent", "student"]),
    async (req, res) => {
        try {
            const userId = req.params.userId;

            const ok = await ensureSessionUserAccess(req, res, userId);
            if (!ok) return;

            const items = await Session.find({ userId })
                .sort({ startedAt: -1 })
                .select("_id userId lessonId startedAt endedAt deviceInfo")
                .lean();
            res.json(items);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    }
);

module.exports = router;
