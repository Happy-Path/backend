const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    sessionId: { type: mongoose.Types.ObjectId, ref: "Session", index: true },
    ts: { type: Date, default: Date.now, index: true },
    type: { type: String, enum: ["emotion", "attention"], required: true },

    // emotion event
    emotion: {
        label: { type: String, enum: ["happy","surprise","neutral","fear","angry","sad","disgust"] },
        scores: { type: Map, of: Number }
    },

    // attention event
    attention: {
        score: { type: Number, min: 0, max: 1 },
        signals: { type: Object }
    },

    latencyMs: Number
}, { timestamps: true });

eventSchema.index({ sessionId: 1, ts: 1 });

module.exports = mongoose.model("Event", eventSchema);
