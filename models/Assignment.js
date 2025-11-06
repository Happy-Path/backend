const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema({
    child_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lesson_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    scheduled_date: { type: Date, required: true },
    assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['scheduled','done','skipped'], default: 'scheduled' }
}, { timestamps: true });

AssignmentSchema.index({ child_id: 1, scheduled_date: 1 });
module.exports = mongoose.model('Assignment', AssignmentSchema);
