// backend/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();

const {
    sendNotification,
    getReceivedNotifications,
    getSentNotifications,
    markNotificationRead,
    markAllAsRead,
    getNotificationRecipients,
} = require("../controllers/notificationController");

const { protect, requireRole } = require("../middleware/authMiddleware");

// All notification routes require authentication
router.use(protect);

// Recipients for sending notifications (admin / teacher / parent)
router.get(
    "/recipients",
    requireRole("admin", "teacher", "parent"),
    getNotificationRecipients
);

// Current user – received notifications
router.get("/", getReceivedNotifications);

// Current user – sent notifications
router.get("/sent", getSentNotifications);

// Send notifications
router.post(
    "/",
    requireRole("admin", "teacher", "parent"),
    sendNotification
);

// Mark single as read
router.patch("/:id/read", markNotificationRead);

// Mark all as read
router.post("/mark-all-read", markAllAsRead);

module.exports = router;
