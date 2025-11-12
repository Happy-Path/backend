// routes/adminRoutes.js
const express = require('express');
const { protect, requireRole } = require('../middleware/authMiddleware');
const {
  adminCreateUser,
  adminListUsers,
  adminUpdateRole,
  adminToggleActive
} = require('../controllers/adminController');

const router = express.Router();

// All admin routes require admin role
router.use(protect, requireRole('admin'));

router.post('/users', adminCreateUser);                 // create any user incl. admin
router.get('/users', adminListUsers);                   // list users
router.patch('/users/:id/role', adminUpdateRole);       // change role
router.patch('/users/:id/active', adminToggleActive);   // enable/disable

module.exports = router;
