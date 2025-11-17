// models/ParentStudentAssignment.js
const mongoose = require("mongoose");

const ParentStudentAssignmentSchema = new mongoose.Schema(
    {
        parentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true, // ⛔ One student can have ONLY one parent
        },
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true, // admin who assigned
        },
        note: { type: String },
    },
    { timestamps: true }
);

// Prevent duplicate assignment pairs
ParentStudentAssignmentSchema.index(
    { parentId: 1, studentId: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    "ParentStudentAssignment",
    ParentStudentAssignmentSchema
);
