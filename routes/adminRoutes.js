// routes/adminRoutes.js
const express = require('express');
const { protect, requireRole } = require('../middleware/authMiddleware');
const {
  adminCreateUser,
  adminListUsers,
  adminUpdateRole,
  adminToggleActive,
  adminResetPassword,
  adminUpdateUser,
} = require('../controllers/adminController');

const router = express.Router();

// All admin routes require admin role
router.use(protect, requireRole('admin'));

router.post('/users', adminCreateUser);                 // create any user incl. admin
router.get('/users', adminListUsers);                   // list users
router.patch('/users/:id', adminUpdateUser);            // update name/email/isActive
router.patch('/users/:id/role', adminUpdateRole);       // change role (kept)
router.patch('/users/:id/active', adminToggleActive);   // enable/disable (legacy)
router.patch('/users/:id/reset-password', adminResetPassword); // reset password -> "password123"

module.exports = router;
