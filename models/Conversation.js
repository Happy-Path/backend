const mongoose = require('mongoose');
const { Schema } = mongoose;

const ParticipantSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['teacher', 'parent'], required: true }
}, { _id: false });

const ConversationSchema = new Schema({
    participants: {
        type: [ParticipantSchema],
        validate: v => v.length === 2, // exactly parent + teacher
        required: true
    },
    childId: { type: Schema.Types.ObjectId, ref: 'User', required: false }, // optional: scope convo to a child
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, default: '' }
}, { timestamps: true });

ConversationSchema.index({ 'participants.userId': 1 });
ConversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', ConversationSchema);
