// backend/routes/quizzes.js
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const roleGuard = require("../middleware/roleGuard");
const Quiz = require("../models/Quiz");
const QuizAttempt = require("../models/QuizAttempt");
const mongoose = require("mongoose");


const router = express.Router();
router.use(protect);

// ---------- Teacher CRUD ----------

// Create quiz
router.post("/", roleGuard(["teacher"]), async (req, res) => {
    try {
        const body = req.body || {};
        const quiz = await Quiz.create({
            title: body.title,
            lessonId: body.lessonId,
            isActive: body.isActive ?? true,
            language: body.language || "en",
            settings: { ...body.settings },
            questions: body.questions,
            createdBy: req.user.id
        });
        res.json(quiz);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

// Update quiz
router.put("/:id", roleGuard(["teacher"]), async (req, res) => {
    try {
        const updated = await Quiz.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

// Get full quiz (teacher view)
router.get("/:id", roleGuard(["teacher"]), async (req, res) => {
    const q = await Quiz.findById(req.params.id).lean();
    if (!q) return res.status(404).json({ message: "Quiz not found" });
    res.json(q);
});

// List attempts for a quiz (teacher/parent)
router.get("/:id/attempts", roleGuard(["teacher","parent"]), async (req, res) => {
    const { userId } = req.query;
    const match = { quizId: req.params.id };
    if (userId) match.userId = userId;
    const attempts = await QuizAttempt.find(match).sort({ createdAt: -1 }).lean();
    res.json(attempts);
});

// Simple summary (pass/fail, best score)
router.get("/:id/summary", roleGuard(["teacher","parent"]), async (req, res) => {
    const { userId } = req.query;
    const match = { quizId: req.params.id };
    if (userId) match.userId = userId;

    const agg = await QuizAttempt.aggregate([
        { $match: match },
        { $group: {
                _id: "$userId",
                attempts: { $sum: 1 },
                bestScore: { $max: "$scorePct" },
                lastAt: { $max: "$createdAt" }
            }
        },
        { $sort: { bestScore: -1 } }
    ]);
    res.json(agg);
});

// ---------- Student endpoints ----------

// Get active quiz by lesson (sanitized; no answers exposed)
router.get("/by-lesson/:lessonId", roleGuard(["student","parent","teacher"]), async (req, res) => {
    const q = await Quiz.findOne({ lessonId: req.params.lessonId, isActive: true }).lean();
    if (!q) return res.json(null);

    // Remove answer keys
    const sanitized = {
        _id: q._id,
        title: q.title,
        lessonId: q.lessonId,
        language: q.language,
        settings: q.settings,
        questions: q.questions.map((qq) => ({
            _id: qq._id,
            type: qq.type,
            promptText: qq.promptText,
            promptImageUrl: qq.promptImageUrl,
            promptAudioUrl: qq.promptAudioUrl,
            order: qq.order,
            options: qq.options.map(o => ({ id: o.id, labelText: o.labelText, imageUrl: o.imageUrl }))
        }))
    };
    res.json(sanitized);
});

// Submit attempt (score server-side)
router.post("/:id/attempts", roleGuard(["student"]), async (req, res) => {
    const quiz = await Quiz.findById(req.params.id).lean();
    if (!quiz || !quiz.isActive) return res.status(404).json({ message: "Quiz not available" });

    // optional: enforce maxAttempts
    const prior = await QuizAttempt.countDocuments({ userId: req.user.id, quizId: quiz._id });
    if (quiz.settings?.maxAttempts && prior >= quiz.settings.maxAttempts) {
        return res.status(400).json({ message: "Max attempts reached" });
    }

    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    const keyed = new Map(quiz.questions.map(q => [String(q._id), q]));

    let correct = 0;
    const graded = answers.map(a => {
        const q = keyed.get(String(a.questionId));
        if (!q) return { ...a, isCorrect: false };
        const ok = a.selectedOptionId === q.correctOptionId;
        if (ok) correct += 1;
        return { ...a, isCorrect: ok };
    });

    const total = quiz.questions.length;
    const scorePct = total ? Math.round((correct / total) * 100) : 0;

    const attempt = await QuizAttempt.create({
        userId: req.user.id,
        quizId: quiz._id,
        lessonId: quiz.lessonId,
        answers: graded,
        correct,
        total,
        scorePct,
        completedAt: new Date(),
        status: "completed"
    });

    const passed = scorePct >= (quiz.settings?.passingScore ?? 60);
    res.json({
        attemptId: attempt._id,
        correct, total, scorePct, passed,
        allowRetry: quiz.settings?.allowRetry ?? true,
        maxAttempts: quiz.settings?.maxAttempts ?? 3,
        remainingAttempts: Math.max(0, (quiz.settings?.maxAttempts ?? 3) - (prior + 1))
    });
});

// --- ADD: list quizzes (teacher)
router.get("/", roleGuard(["teacher"]), async (req, res) => {
    try {
        const { lessonId } = req.query;
        const filter = {};
        if (lessonId) filter.lessonId = lessonId;
        const qs = await Quiz.find(filter)
            .sort({ updatedAt: -1 })
            .select("_id title lessonId isActive createdAt updatedAt questions")
            .lean();

        res.json(
            qs.map(q => ({
                _id: q._id,
                title: q.title,
                lessonId: q.lessonId,
                isActive: q.isActive,
                questionsCount: (q.questions || []).length,
                createdAt: q.createdAt,
                updatedAt: q.updatedAt
            }))
        );
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- ADD: toggle active
router.patch("/:id/active", roleGuard(["teacher"]), async (req, res) => {
    try {
        const { isActive } = req.body || {};
        const updated = await Quiz.findByIdAndUpdate(
            req.params.id,
            { isActive: !!isActive },
            { new: true }
        ).select("_id title isActive");
        if (!updated) return res.status(404).json({ message: "Quiz not found" });
        res.json(updated);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

// --- ADD: delete quiz
router.delete("/:id", roleGuard(["teacher"]), async (req, res) => {
    try {
        await Quiz.findByIdAndDelete(req.params.id);
        await QuizAttempt.deleteMany({ quizId: new mongoose.Types.ObjectId(req.params.id) });
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

module.exports = router;
