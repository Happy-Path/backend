const mongoose = require('mongoose');
const { Schema } = mongoose;

const MessageSchema = new Schema({
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['teacher', 'parent'], required: true },
    text: { type: String, trim: true, default: '' },
    // optional later:
    attachments: [{
        url: String,
        name: String,
        type: String,
        size: Number
    }],
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

MessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', MessageSchema);
