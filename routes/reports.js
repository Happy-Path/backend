// backend/routes/reports.js
const express = require("express");
const Event = require("../models/Event");
const Session = require("../models/Session");
const { protect } = require("../middleware/authMiddleware");
const roleGuard = require("../middleware/roleGuard");
const {
    parentCanAccessStudent,
} = require("../controllers/parentStudentAssignmentController");

const router = express.Router();
router.use(protect);

// Helper for learner-based reports
async function ensureReportAccessForLearner(req, res, userId) {
    const meId = req.user._id.toString();
    const role = req.user.role;

    // Teacher: allowed for any user
    if (role === "teacher") return true;

    // Parent: must be assigned to this child
    if (role === "parent") {
        const allowed = await parentCanAccessStudent(meId, userId);
        if (!allowed) {
            res
                .status(403)
                .json({ message: "Not authorized for this child" });
            return false;
        }
        return true;
    }

    // other roles not expected here (roleGuard) but keep safe
    res.status(403).json({ message: "Not authorized" });
    return false;
}

// Daily roll-ups for a learner (parent/teacher can view)
router.get(
    "/learner/:userId/daily",
    roleGuard(["parent", "teacher"]),
    async (req, res) => {
        try {
            const userId = req.params.userId;
            const { from, to, timezone } = req.query;
            const tz =
                typeof timezone === "string" && timezone.trim()
                    ? timezone.trim()
                    : "UTC"; // e.g., "+05:30"

            const ok = await ensureReportAccessForLearner(
                req,
                res,
                userId
            );
            if (!ok) return;

            const start = from
                ? new Date(`${from}T00:00:00.000Z`)
                : new Date(Date.now() - 7 * 24 * 3600 * 1000);
            const end = to
                ? new Date(`${to}T23:59:59.999Z`)
                : new Date();

            const sessions = await Session.find({
                userId,
                startedAt: { $lte: end },
                $or: [
                    { endedAt: { $gte: start } },
                    { endedAt: null },
                ],
            }).select("_id");
            const sessionIds = sessions.map((s) => s._id);

            const agg = await Event.aggregate([
                {
                    $match: {
                        sessionId: { $in: sessionIds },
                        ts: { $gte: start, $lte: end },
                    },
                },
                {
                    $addFields: {
                        day: {
                            $dateToString: {
                                format: "%Y-%m-%d",
                                date: "$ts",
                                timezone: tz,
                            },
                        },
                    },
                },
                {
                    $group: {
                        _id: "$day",
                        attentionSamples: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$type", "attention"] },
                                    1,
                                    0,
                                ],
                            },
                        },
                        attentionAvg: {
                            $avg: {
                                $cond: [
                                    { $eq: ["$type", "attention"] },
                                    "$attention.score",
                                    null,
                                ],
                            },
                        },
                        attentionMin: {
                            $min: {
                                $cond: [
                                    { $eq: ["$type", "attention"] },
                                    "$attention.score",
                                    null,
                                ],
                            },
                        },
                        attentionMax: {
                            $max: {
                                $cond: [
                                    { $eq: ["$type", "attention"] },
                                    "$attention.score",
                                    null,
                                ],
                            },
                        },
                        low: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ["$type", "attention"] },
                                            { $lt: ["$attention.score", 0.4] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        med: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ["$type", "attention"] },
                                            {
                                                $and: [
                                                    {
                                                        $gte: [
                                                            "$attention.score",
                                                            0.4,
                                                        ],
                                                    },
                                                    {
                                                        $lt: [
                                                            "$attention.score",
                                                            0.7,
                                                        ],
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        high: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ["$type", "attention"] },
                                            { $gte: ["$attention.score", 0.7] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        // push emotions only for emotion events
                        emotions: {
                            $push: {
                                $cond: [
                                    { $eq: ["$type", "emotion"] },
                                    "$emotion.label",
                                    "$$REMOVE",
                                ],
                            },
                        },
                    },
                },
                {
                    $project: {
                        date: "$_id",
                        _id: 0,
                        attention: {
                            avg: "$attentionAvg",
                            min: "$attentionMin",
                            max: "$attentionMax",
                            samples: "$attentionSamples",
                            lowPct: {
                                $cond: [
                                    "$attentionSamples",
                                    { $divide: ["$low", "$attentionSamples"] },
                                    0,
                                ],
                            },
                            medPct: {
                                $cond: [
                                    "$attentionSamples",
                                    { $divide: ["$med", "$attentionSamples"] },
                                    0,
                                ],
                            },
                            highPct: {
                                $cond: [
                                    "$attentionSamples",
                                    { $divide: ["$high", "$attentionSamples"] },
                                    0,
                                ],
                            },
                        },
                        emotions: {
                            $arrayToObject: {
                                $map: {
                                    input: [
                                        "happy",
                                        "surprise",
                                        "neutral",
                                        "fear",
                                        "angry",
                                        "sad",
                                        "disgust",
                                    ],
                                    as: "lbl",
                                    in: [
                                        "$$lbl",
                                        {
                                            $size: {
                                                $filter: {
                                                    input: "$emotions",
                                                    as: "e",
                                                    cond: {
                                                        $eq: ["$$e", "$$lbl"],
                                                    },
                                                },
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                },
                { $sort: { date: 1 } },
            ]);

            res.json(agg);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    }
);

// Quick per-session trend (student/parent/teacher)
router.get(
    "/session/:sessionId",
    roleGuard(["student", "parent", "teacher"]),
    async (req, res) => {
        try {
            const sid = req.params.sessionId;
            const meId = req.user._id.toString();
            const role = req.user.role;

            const session = await Session.findById(sid)
                .select("userId")
                .lean();
            if (!session) {
                return res
                    .status(404)
                    .json({ message: "Session not found" });
            }

            const userId = session.userId.toString();

            // Student: only own sessions
            if (role === "student" && meId !== userId) {
                return res
                    .status(403)
                    .json({ message: "Not authorized" });
            }

            // Parent: only sessions of assigned children
            if (role === "parent") {
                const allowed = await parentCanAccessStudent(
                    meId,
                    userId
                );
                if (!allowed) {
                    return res
                        .status(403)
                        .json({ message: "Not authorized for this child" });
                }
            }

            const events = await Event.find({ sessionId: sid })
                .sort({ ts: 1 })
                .lean();
            res.json({
                attentionTrend: events
                    .filter((e) => e.type === "attention")
                    .map((e) => ({
                        ts: e.ts,
                        score: e.attention?.score,
                    })),
                emotions: events
                    .filter((e) => e.type === "emotion")
                    .map((e) => ({
                        ts: e.ts,
                        label: e.emotion?.label,
                    })),
            });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    }
);

module.exports = router;
