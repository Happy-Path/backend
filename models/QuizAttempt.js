// backend/models/QuizAttempt.js
const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
    questionId: { type: mongoose.Types.ObjectId, required: true },
    selectedOptionId: { type: String, required: true },
    isCorrect: { type: Boolean, default: false },
    timeTakenSec: { type: Number, default: 0 }
}, { _id: false });

const quizAttemptSchema = new mongoose.Schema({
    userId:   { type: mongoose.Types.ObjectId, ref: "User", index: true, required: true },
    quizId:   { type: mongoose.Types.ObjectId, ref: "Quiz", index: true, required: true },
    lessonId: { type: String, index: true },
    startedAt:  { type: Date, default: Date.now },
    completedAt:{ type: Date },
    answers:  { type: [answerSchema], default: [] },
    correct:  { type: Number, default: 0 },
    total:    { type: Number, default: 0 },
    scorePct: { type: Number, default: 0 },
    status:   { type: String, enum: ["completed","abandoned"], default: "completed" }
}, { timestamps: true });

quizAttemptSchema.index({ userId: 1, quizId: 1, createdAt: -1 });

module.exports = mongoose.model("QuizAttempt", quizAttemptSchema);
