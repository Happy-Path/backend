// controllers/lesson.controller.js
const Lesson = require('../models/Lesson');
const { extractYouTubeId, youtubeThumb } = require('../utils/youtube');

exports.createLesson = async (req, res) => {
    try {
        // role guard: only teacher allowed
        if (req.user?.role !== 'teacher') {
            return res.status(403).json({ message: 'Only teachers can create lessons.' });
        }

        const {
            title, description, goal, category, level, video_url, status = 'published',
        } = req.body;

        // basic validation
        if (!title || !description || !goal || !category || !level || !video_url) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }

        const video_id = extractYouTubeId(video_url);
        if (!video_id) {
            return res.status(400).json({ message: 'Invalid YouTube URL.' });
        }

        const thumbnail_url = youtubeThumb(video_id, 'hq');

        const lesson = await Lesson.create({
            title,
            description,
            goal,
            category,
            level,
            video_url,
            video_id,
            thumbnail_url,
            status,
            created_by: req.user._id,
        });

        return res.status(201).json({ lesson });
    } catch (err) {
        console.error('createLesson error:', err);
        return res.status(500).json({ message: 'Server error.' });
    }
};

exports.listLessons = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        const q = {};
        if (status) q.status = status;

        // Teachers can see their drafts; others see only published
        if (req.user?.role === 'teacher') {
            // optional filter to only their lessons:
            // q.created_by = req.user._id;
        } else {
            q.status = 'published';
        }

        const skip = (Number(page) - 1) * Number(limit);
        const [items, total] = await Promise.all([
            Lesson.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
            Lesson.countDocuments(q),
        ]);

        res.json({
            items,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
        });
    } catch (err) {
        console.error('listLessons error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.deleteLesson = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id);
        if (!lesson) return res.status(404).json({ message: 'Not found' });
        //  only owner can delete
        if (String(lesson.created_by) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        await lesson.deleteOne();
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateLesson = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id);
        if (!lesson) return res.status(404).json({ message: 'Not found' });

        const me = String(req.user?._id || req.user?.id);
        if (String(lesson.created_by) !== me && req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const fields = ['title', 'description', 'goal', 'category', 'level', 'video_url', 'status'];
        fields.forEach(f => {
            if (req.body[f] !== undefined) lesson[f] = req.body[f];
        });

        if (req.body.video_url) {
            const { extractYouTubeId, youtubeThumb } = require('../utils/youtube');
            const vid = extractYouTubeId(lesson.video_url);
            if (!vid) return res.status(400).json({ message: 'Invalid YouTube URL' });
            lesson.video_id = vid;
            lesson.thumbnail_url = youtubeThumb(vid, 'hq');
        }

        await lesson.save();
        res.json({ lesson });
    } catch (e) {
        console.error('updateLesson error:', e);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getLessonById = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id);
        if (!lesson) return res.status(404).json({ message: 'Not found' });

        // Non-teachers must only view published lessons
        if (req.user?.role !== 'teacher' && lesson.status !== 'published') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        res.json({ lesson });
    } catch (e) {
        console.error('getLessonById error:', e);
        res.status(500).json({ message: 'Server error' });
    }
};
