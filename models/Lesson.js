// models/Lesson.js
const mongoose = require('mongoose');

const LessonSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, minlength: 3 },
        description: { type: String, required: true, minlength: 10 },
        goal: { type: String, required: true },
        category: { type: String, enum: ['numbers','letters','colors','shapes','emotions'], required: true },
        level: { type: String, enum: ['beginner','intermediate','advanced'], required: true },
        video_url: { type: String, required: true },
        video_id: { type: String, required: true, minlength: 11, maxlength: 11 },
        thumbnail_url: { type: String, required: true },
        status: { type: String, enum: ['draft','published'], default: 'published', index: true },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
);

LessonSchema.index({ created_by: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Lesson', LessonSchema);
