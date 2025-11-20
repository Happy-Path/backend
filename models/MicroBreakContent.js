// backend/models/MicroBreakContent.js
const mongoose = require("mongoose");

const microBreakContentSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        youtubeUrl: {
            type: String,
            required: true,
            trim: true,
        },
        boosterText: {
            type: String,
            required: true,
            trim: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("MicroBreakContent", microBreakContentSchema);
