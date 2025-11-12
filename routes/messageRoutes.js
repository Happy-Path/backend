const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { protect, requireRole } = require('../middleware/authMiddleware');
const User = require('../models/User');
const mongoose = require('mongoose');

// Utility: ensure user is participant
async function ensureParticipant(conversationId, userId) {
    const convo = await Conversation.findById(conversationId);
    if (!convo) return null;
    const isParticipant = convo.participants.some(p => p.userId.toString() === userId.toString());
    return isParticipant ? convo : null;
}

// GET /api/messages/conversations  (list user’s convos with names + unreadCount)
router.get('/conversations', protect, async (req, res) => {
    const userId = (req.user && (req.user._id || req.user.id))?.toString();

    const convos = await Conversation.find({ 'participants.userId': userId })
        .sort({ lastMessageAt: -1 })
        .select('_id participants childId lastMessageAt lastMessagePreview')
        .populate('participants.userId', 'name email role') // 👈 get names/emails/roles
        .lean();

    // compute unread per conversation for this user
    const convoIds = convos.map(c => c._id);
    const unreadAgg = await Message.aggregate([
        { $match: {
                conversationId: { $in: convoIds },
                readBy: { $ne: new mongoose.Types.ObjectId(userId) },
                senderId: { $ne: new mongoose.Types.ObjectId(userId) },
            }
        },
        { $group: { _id: '$conversationId', count: { $sum: 1 } } }
    ]);

    const unreadMap = {};
    unreadAgg.forEach(u => { unreadMap[u._id.toString()] = u.count; });

    const withUnread = convos.map(c => ({
        ...c,
        unreadCount: unreadMap[c._id.toString()] || 0,
    }));

    res.json(withUnread);
});


// POST /api/messages/conversations  (create or get existing)
router.post(
    '/conversations',
    protect,
    requireRole('teacher', 'parent'),
    async (req, res) => {
        try {
            const userId = req.user.id;
            const userRole = req.user.role; // 'teacher' or 'parent'
            const { peerUserId, childId } = req.body;

            // 🔹 Validate peer existence
            const peer = await User.findById(peerUserId).select('_id role');
            if (!peer) {
                return res.status(404).json({ message: 'Peer user not found' });
            }

            // 🔹 Validate peer role (must be the opposite role)
            if (peer.role === userRole) {
                return res.status(400).json({
                    message: 'Conversation must be between a parent and a teacher',
                });
            }

            // 🔹 Only teacher or parent roles allowed
            if (!['teacher', 'parent'].includes(peer.role)) {
                return res
                    .status(400)
                    .json({ message: 'Peer must be a teacher or a parent' });
            }

            // ✅ Sanitize: ensure only teacher-parent pair
            const participants = [
                { userId, role: userRole },
                { userId: peerUserId, role: peer.role },
            ];

            // 🔹 Check for existing conversation (optionally per child)
            const existing = await Conversation.findOne({
                'participants.userId': { $all: [userId, peerUserId] },
                ...(childId ? { childId } : {}),
            });

            if (existing) return res.json(existing);

            // 🔹 Create new conversation
            const convo = await Conversation.create({
                participants,
                childId: childId || undefined,
                lastMessagePreview: '',
            });

            res.status(201).json(convo);
        } catch (err) {
            console.error('Error creating conversation:', err);
            res.status(500).json({ message: 'Server error' });
        }
    }
);


// GET /api/messages/:conversationId  (paged messages)
router.get('/:conversationId', protect, async (req, res) => {
    const { conversationId } = req.params;
    const convo = await ensureParticipant(conversationId, req.user.id);
    if (!convo) return res.status(403).json({ message: 'Forbidden' });

    const { page = 1, limit = 30 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const items = await Message.find({ conversationId })
        .sort({ createdAt: -1 })
        .skip(skip).limit(Number(limit))
        .lean();

    res.json({ items: items.reverse() });
});

// POST /api/messages/:conversationId  (send message)
router.post('/:conversationId', protect, requireRole('teacher', 'parent'), async (req, res) => {
    const { conversationId } = req.params;
    const { text } = req.body;

    const convo = await ensureParticipant(conversationId, req.user.id);
    if (!convo) return res.status(403).json({ message: 'Forbidden' });

    const msg = await Message.create({
        conversationId,
        senderId: req.user.id,
        senderRole: req.user.role,
        text: (text || '').slice(0, 4000),
        readBy: [req.user.id]
    });

    await Conversation.findByIdAndUpdate(conversationId, {
        lastMessageAt: msg.createdAt,
        lastMessagePreview: msg.text?.slice(0, 120) || ''
    });

    res.status(201).json(msg);
});

// POST /api/messages/:conversationId/read  (mark read)
router.post('/:conversationId/read', protect, async (req, res) => {
    const { conversationId } = req.params;
    const convo = await ensureParticipant(conversationId, req.user.id);
    if (!convo) return res.status(403).json({ message: 'Forbidden' });

    await Message.updateMany(
        { conversationId, readBy: { $ne: req.user.id } },
        { $addToSet: { readBy: req.user.id } }
    );
    res.json({ ok: true });
});

// GET /api/messages/unread/count  (badge)
router.get('/unread/count', protect, async (req, res) => {
    const convos = await Conversation.find({ 'participants.userId': req.user.id }).select('_id').lean();
    const ids = convos.map(c => c._id);
    const count = await Message.countDocuments({
        conversationId: { $in: ids },
        readBy: { $ne: req.user.id },
        senderId: { $ne: req.user.id }
    });
    res.json({ count });
});

module.exports = router;
