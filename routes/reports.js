// backend/routes/reports.js
const express = require("express");
const Event = require("../models/Event");
const Session = require("../models/Session");
const QuizAttempt = require("../models/QuizAttempt");
const Quiz = require("../models/Quiz");
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

/**
 * -------------------------------------------------------------------
 * DAILY EMOTION + ATTENTION SUMMARY FOR LEARNER
 * -------------------------------------------------------------------
 */
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

            if (!sessionIds.length) {
                return res.json([]);
            }

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

/**
 * -------------------------------------------------------------------
 * PER-SESSION TREND (ATTENTION + EMOTION)
 * -------------------------------------------------------------------
 */
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

/**
 * -------------------------------------------------------------------
 * QUIZ SUMMARY FOR LEARNER (TEACHER/PARENT VIEW)
 * -------------------------------------------------------------------
 * GET /api/reports/learner/:userId/quizzes?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns one row per quiz the learner has attempted:
 * - quizId
 * - quizTitle
 * - lessonId
 * - attempts
 * - completedAttempts
 * - abandonedAttempts
 * - bestScore
 * - avgScore
 * - lastScore
 * - firstAttemptAt
 * - lastAttemptAt
 * - passedAttempts
 * - passingScore
 * -------------------------------------------------------------------
 */
router.get(
    "/learner/:userId/quizzes",
    roleGuard(["parent", "teacher"]),
    async (req, res) => {
        try {
            const userId = req.params.userId;
            const { from, to } = req.query;

            const ok = await ensureReportAccessForLearner(req, res, userId);
            if (!ok) return;

            const start = from
                ? new Date(`${from}T00:00:00.000Z`)
                : new Date(Date.now() - 7 * 24 * 3600 * 1000);
            const end = to
                ? new Date(`${to}T23:59:59.999Z`)
                : new Date();

            // 1) Get all attempts for this learner in the date range
            const attempts = await QuizAttempt.find({
                userId,
                createdAt: { $gte: start, $lte: end },
            })
                .sort({ createdAt: 1 })
                .lean();

            if (!attempts.length) {
                return res.json([]);
            }

            // 2) Load quiz metadata (titles, passingScore, lessonId)
            const quizIds = [
                ...new Set(attempts.map((a) => String(a.quizId))),
            ];
            const quizzes = await Quiz.find({ _id: { $in: quizIds } })
                .select("title settings.passingScore lessonId")
                .lean();

            const quizMap = new Map();
            for (const q of quizzes) {
                quizMap.set(String(q._id), q);
            }

            // 3) Aggregate in-memory per quizId
            const resultMap = new Map();

            for (const a of attempts) {
                const qid = String(a.quizId);
                const key = qid;
                if (!resultMap.has(key)) {
                    resultMap.set(key, {
                        quizId: qid,
                        lessonId: a.lessonId || null,
                        attempts: 0,
                        completedAttempts: 0,
                        abandonedAttempts: 0,
                        bestScore: 0,
                        totalScore: 0,
                        passedAttempts: 0,
                        firstAttemptAt: a.createdAt,
                        lastAttemptAt: a.createdAt,
                        lastScore: a.scorePct || 0,
                    });
                }
                const row = resultMap.get(key);
                const score = a.scorePct || 0;

                row.attempts += 1;
                if (a.status === "completed") row.completedAttempts += 1;
                if (a.status === "abandoned") row.abandonedAttempts += 1;

                row.bestScore = Math.max(row.bestScore, score);
                row.totalScore += score;

                if (a.createdAt < row.firstAttemptAt) {
                    row.firstAttemptAt = a.createdAt;
                }
                if (a.createdAt > row.lastAttemptAt) {
                    row.lastAttemptAt = a.createdAt;
                    row.lastScore = score;
                }
            }

            // 4) Attach titles + passingScore, compute avgScore and passedAttempts
            const response = [];
            for (const [key, row] of resultMap.entries()) {
                const quizDoc = quizMap.get(key);
                const passingScore =
                    quizDoc?.settings?.passingScore != null
                        ? quizDoc.settings.passingScore
                        : 60;

                // Count passed attempts using that passingScore
                const attemptsForQuiz = attempts.filter(
                    (a) => String(a.quizId) === key
                );
                const passedAttempts = attemptsForQuiz.filter(
                    (a) => (a.scorePct || 0) >= passingScore
                ).length;

                response.push({
                    quizId: row.quizId,
                    quizTitle: quizDoc?.title || "Untitled quiz",
                    lessonId: row.lessonId,
                    attempts: row.attempts,
                    completedAttempts: row.completedAttempts,
                    abandonedAttempts: row.abandonedAttempts,
                    bestScore: row.bestScore,
                    avgScore:
                        row.attempts > 0
                            ? Math.round(
                            (row.totalScore / row.attempts) * 10
                        ) / 10
                            : 0,
                    lastScore: row.lastScore,
                    firstAttemptAt: row.firstAttemptAt,
                    lastAttemptAt: row.lastAttemptAt,
                    passedAttempts,
                    passingScore,
                });
            }

            // Sort by lastAttemptAt desc (most recent at top)
            response.sort(
                (a, b) =>
                    new Date(b.lastAttemptAt) - new Date(a.lastAttemptAt)
            );

            res.json(response);
        } catch (err) {
            console.error("quiz summary error", err);
            res.status(500).json({ message: err.message });
        }
    }
);

module.exports = router;
