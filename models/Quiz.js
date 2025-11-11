// backend/models/Quiz.js
const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema({
    labelText: { type: String, default: "" },     // visible text, optional if image
    imageUrl:  { type: String, default: "" },     // optional picture choice
    id:        { type: String, required: true },  // stable client id for answers
}, { _id: false });

const questionSchema = new mongoose.Schema({
    type: { type: String, enum: ["single", "image"], default: "single" },
    promptText: { type: String, default: "" },     // will be read via TTS too
    promptImageUrl: { type: String, default: "" }, // optional visual stimulus
    promptAudioUrl: { type: String, default: "" }, // optional pre-recorded cue
    options: { type: [optionSchema], validate: v => v.length >= 2 && v.length <= 4 },
    correctOptionId: { type: String, required: true }, // 🔒 never sent to student
    order: { type: Number, default: 0 }
}, { _id: true });

const quizSchema = new mongoose.Schema({
    title: { type: String, required: true },
    lessonId: { type: String, index: true },       // tie to your video lesson
    isActive: { type: Boolean, default: true },
    language: { type: String, default: "en" },
    settings: {
        allowRetry: { type: Boolean, default: true },
        maxAttempts: { type: Number, default: 3 },
        shuffleOptions: { type: Boolean, default: true },
        passingScore: { type: Number, default: 60 }
    },
    questions: { type: [questionSchema], validate: v => v.length >= 1 },
    createdBy: { type: mongoose.Types.ObjectId, ref: "User", index: true }
}, { timestamps: true });

module.exports = mongoose.model("Quiz", quizSchema);
