// routes/lessonRoutes.js
const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const {
    createLesson,
    listLessons,
    deleteLesson,
    updateLesson,
    getLessonById
} = require('../controllers/lessonController');

router.post('/', protect, createLesson);
router.get('/', protect, listLessons);
router.delete('/:id', protect, deleteLesson);
router.put('/:id', protect, updateLesson);
router.get('/:id', protect, getLessonById);

module.exports = router;
