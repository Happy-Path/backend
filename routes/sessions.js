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
const Notification = require("../models/Notification");
const ParentStudentAssignment = require("../models/ParentStudentAssignment");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
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

// Low-attention / negative-emotion alert → notify parent
// POST /api/sessions/:id/low-attention-alert
// body: { reason: "multiple_episodes" | "long_episode" | "student_break" }
router.post("/:id/low-attention-alert", roleGuard(["student"]), async (req, res) => {
    try {
        const sessionId = req.params.id;
        const { reason } = req.body || {};

        const session = await Session.findById(sessionId);
        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }

        // Safety: student can only raise alert for their own session
        if (session.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized for this session" });
        }

        // Find parent for this student
        const assignment = await ParentStudentAssignment.findOne({
            studentId: session.userId,
        }).populate("parentId");

        if (!assignment || !assignment.parentId) {
            // No parent assigned → just return OK; nothing to notify
            return res.json({ message: "No parent assignment; alert skipped" });
        }

        const parent = assignment.parentId;

        // Find a system admin sender
        const adminSender = await User.findOne({ role: "admin", isActive: true })
            .sort({ createdAt: 1 })
            .lean();

        if (!adminSender) {
            console.error("No admin user found to send attention alert");
            return res.status(500).json({ message: "No admin user to send alert" });
        }

        // Optional: enrich with lesson title
        let lessonTitle = "this lesson";
        if (session.lessonId) {
            try {
                const lesson = await Lesson.findById(session.lessonId).select("title").lean();
                if (lesson?.title) lessonTitle = lesson.title;
            } catch {
                // ignore
            }
        }

        const childName = req.user.name || "your child";

        let title = `${childName} needed extra support today`;
        let message =
            `Today during "${lessonTitle}", ${childName} showed signs of low attention or sadness. ` +
            `Consider reviewing this lesson together or trying again when they are more rested.`;

        if (reason === "student_break") {
            title = `${childName} asked for a small break`;
            message =
                `During "${lessonTitle}", ${childName} pressed "I want a small break". ` +
                `You may want to check in and see how they are feeling.`;
        } else if (reason === "long_episode") {
            title = `${childName} struggled to re-focus during "${lessonTitle}"`;
            message =
                `${childName} stayed in a low-attention or upset state for a while during "${lessonTitle}". ` +
                `A gentle break or trying again later might help.`;
        }

        await Notification.create({
            title,
            message,
            type: "attention_alert",
            purpose: "system",
            sender: adminSender._id,
            senderRole: "admin",
            recipient: parent._id,
            recipientRole: "parent",
            isRead: false,
        });

        res.json({ message: "Alert sent to parent" });
    } catch (err) {
        console.error("low-attention-alert error", err);
        res.status(500).json({ message: "Failed to send attention alert" });
    }
});

module.exports = router;
