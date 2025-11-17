// models/Session.js
const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Types.ObjectId, ref: "User", index: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: Date,
    lessonId: String,
    deviceInfo: Object
}, { timestamps: true });

module.exports = mongoose.model("Session", sessionSchema);
