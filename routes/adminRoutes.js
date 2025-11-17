// routes/adminRoutes.js
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const roleGuard = require("../middleware/roleGuard");

const {
  adminCreateUser,
  adminListUsers,
  adminUpdateRole,
  adminToggleActive,
  adminResetPassword,
  adminUpdateUser,
} = require("../controllers/adminController");

const {
  listAssignments,
  assignStudents,
  unassign,
} = require("../controllers/parentStudentAssignmentController");

const router = express.Router();

// admin only
router.use(protect);
router.use(roleGuard(["admin"]));

// -------- USERS --------
router.post("/users", adminCreateUser);               // create any user incl. admin
router.get("/users", adminListUsers);                 // list users
router.patch("/users/:id", adminUpdateUser);          // update name/email/isActive
router.patch("/users/:id/active", adminToggleActive); // enable/disable
router.patch("/users/:id/reset-password", adminResetPassword); // reset password
router.patch("/users/:id/role", adminUpdateRole);     // change role

// -------- PARENT–STUDENT ASSIGNMENTS --------
router.get("/assignments", listAssignments);
router.post("/assignments", assignStudents);
router.delete("/assignments/:id", unassign);

module.exports = router;
