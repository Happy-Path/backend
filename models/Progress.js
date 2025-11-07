// backend/models/Progress.js
const mongoose = require("mongoose");

const progressSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Types.ObjectId, ref: "User", index: true, required: true },
        lessonId: { type: String, index: true, required: true },
        // absolute seconds
        positionSec: { type: Number, default: 0 },
        durationSec: { type: Number, default: 0 },
        // derived
        percent: { type: Number, default: 0 }, // 0..100
        completed: { type: Boolean, default: false },
        // audit
        lastPingAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

progressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

module.exports = mongoose.model("Progress", progressSchema);
