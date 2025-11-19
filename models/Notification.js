// backend/models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ["attention_alert", "progress_update", "quiz_result", "general", "system"],
            default: "general",
        },
        // Purpose: system (admin) vs learning (teacher) etc.
        purpose: {
            type: String,
            enum: ["system", "learning"],
            default: "learning",
        },

        // Sender info
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        senderRole: {
            type: String,
            enum: ["admin", "teacher", "parent"],
            required: true,
        },

        // Recipient info
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        recipientRole: {
            type: String,
            enum: ["parent", "teacher"],
            required: true,
        },

        isRead: {
            type: Boolean,
            default: false,
        },
        readAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Notification", notificationSchema);
