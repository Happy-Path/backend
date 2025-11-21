// routes/parentRoutes.js
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const roleGuard = require("../middleware/roleGuard");
const {
    myChildren,
    parentCanAccessStudent,
} = require("../controllers/parentStudentAssignmentController");
const QuizAttempt = require("../models/QuizAttempt");
const Quiz = require("../models/Quiz");

const router = express.Router();

router.use(protect);
router.use(roleGuard(["parent"]));

// return children of logged-in parent
router.get("/children", myChildren);

/**
 * Quiz history for a specific child (detailed, per attempt).
 * Used by ParentProgress → Quiz Results.
 *
 * GET /api/parent/children/:studentId/quizzes
 */
router.get("/children/:studentId/quizzes", async (req, res) => {
    try {
        const parentId = req.user._id.toString();
        const studentId = req.params.studentId;

        // Ensure this parent is actually linked to this child
        const allowed = await parentCanAccessStudent(parentId, studentId);
        if (!allowed) {
            return res
                .status(403)
                .json({ message: "Not authorized for this child" });
        }

        // All completed attempts for this child (newest first)
        const attempts = await QuizAttempt.find({
            userId: studentId,
            status: "completed",
        })
            .sort({ completedAt: -1, createdAt: -1 })
            .lean();

        if (!attempts.length) {
            return res.json([]);
        }

        // Load quiz metadata (title, questions, lessonId)
        const quizIds = [
            ...new Set(attempts.map((a) => String(a.quizId))),
        ];
        const quizzes = await Quiz.find({ _id: { $in: quizIds } })
            .select("title lessonId questions")
            .lean();

        const quizMap = new Map();
        for (const q of quizzes) {
            quizMap.set(String(q._id), q);
        }

        const results = attempts.map((attempt) => {
            const quizId = String(attempt.quizId);
            const quizDoc = quizMap.get(quizId);

            const lessonId = attempt.lessonId || quizDoc?.lessonId || null;
            const moduleName = quizDoc?.title || "Quiz";

            const answers = attempt.answers || [];
            const totalQuestions =
                attempt.total || answers.length || 0;
            const correctAnswers =
                attempt.correct != null
                    ? attempt.correct
                    : answers.filter((a) => a.isCorrect).length;

            // Sum timeTakenSec from each answer → minutes
            let totalTimeSec = 0;
            for (const a of answers) {
                if (typeof a.timeTakenSec === "number") {
                    totalTimeSec += a.timeTakenSec;
                }
            }
            const timeSpent =
                totalTimeSec > 0
                    ? Math.max(1, Math.round(totalTimeSec / 60)) // at least 1 min if any time
                    : null;

            // Build per-question details for parent
            const questions = answers.map((ans) => {
                const qDoc =
                    quizDoc?.questions?.find(
                        (q) =>
                            String(q._id) ===
                            String(ans.questionId)
                    ) || null;

                const opt =
                    qDoc?.options?.find(
                        (o) => o.id === ans.selectedOptionId
                    ) || null;

                const questionText =
                    qDoc?.promptText || "Question";
                const answerLabel =
                    opt?.labelText ||
                    opt?.imageUrl ||
                    ans.selectedOptionId;

                return {
                    id: String(ans.questionId),
                    question: questionText,
                    answer: answerLabel,
                    correct: !!ans.isCorrect,
                };
            });

            return {
                id: String(attempt._id),
                moduleId: lessonId, // used to filter by module in ParentProgress
                moduleName,
                date:
                    attempt.completedAt ||
                    attempt.createdAt ||
                    new Date(),
                score: attempt.scorePct || 0,
                totalQuestions,
                correctAnswers,
                timeSpent,
                questions,
            };
        });

        res.json(results);
    } catch (err) {
        console.error("parent child quizzes error", err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
