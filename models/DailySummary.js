// models/DailySummary.js
const mongoose = require("mongoose");

const dailySummarySchema = new mongoose.Schema({
    userId: { type: mongoose.Types.ObjectId, ref: "User", index: true },
    date: { type: String, index: true }, // "YYYY-MM-DD"
    attention: { avg: Number, min: Number, max: Number, samples: Number, lowPct: Number, medPct: Number, highPct: Number },
    emotions: { type: Map, of: Number }
}, { timestamps: true });

dailySummarySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DailySummary", dailySummarySchema);
