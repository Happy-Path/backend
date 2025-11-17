// routes/parentRoutes.js
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const roleGuard = require("../middleware/roleGuard");
const { myChildren } = require("../controllers/parentStudentAssignmentController");

const router = express.Router();

router.use(protect);
router.use(roleGuard(["parent"]));

// return children of logged-in parent
router.get("/children", myChildren);

module.exports = router;
