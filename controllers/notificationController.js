// backend/controllers/notificationController.js
const Notification = require("../models/Notification");
const User = require("../models/User");

// Helper to decide purpose from sender role
function derivePurposeFromRole(role) {
    if (role === "admin") return "system";
    if (role === "teacher") return "learning";
    if (role === "parent") return "learning";
    return "learning";
}

/**
 * POST /api/notifications
 * Body: { recipientIds: string[], recipientRole: "parent" | "teacher", type, title, message }
 * Allowed:
 *   - admin: recipientRole in ["parent", "teacher"]
 *   - teacher: recipientRole === "parent"
 *   - parent:  recipientRole === "parent"
 */
exports.sendNotification = async (req, res) => {
    try {
        const { recipientIds, recipientRole, type, title, message } = req.body;
        const senderId = req.user._id;
        const senderRole = req.user.role;

        if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
            return res
                .status(400)
                .json({ message: "recipientIds is required and must be a non-empty array" });
        }

        if (!recipientRole || !["parent", "teacher"].includes(recipientRole)) {
            return res
                .status(400)
                .json({ message: "recipientRole must be 'parent' or 'teacher'" });
        }

        // Role-based permissions
        if (senderRole === "teacher" && recipientRole !== "parent") {
            return res
                .status(403)
                .json({ message: "Teachers can only send notifications to parents" });
        }

        if (senderRole === "parent" && recipientRole !== "parent") {
            return res
                .status(403)
                .json({ message: "Parents can only send notifications to other parents" });
        }

        if (senderRole === "admin" && !["parent", "teacher"].includes(recipientRole)) {
            return res
                .status(403)
                .json({ message: "Admins can only send notifications to parents or teachers" });
        }

        const purpose = derivePurposeFromRole(senderRole);

        const docsToCreate = recipientIds.map((recipientId) => ({
            title,
            message,
            type: type || (senderRole === "admin" ? "system" : "general"),
            purpose,
            sender: senderId,
            senderRole,
            recipient: recipientId,
            recipientRole,
            isRead: false,
        }));

        const created = await Notification.insertMany(docsToCreate);

        return res.status(201).json({
            message: "Notifications sent successfully",
            count: created.length,
        });
    } catch (err) {
        console.error("Error sending notifications:", err);
        return res.status(500).json({ message: "Failed to send notifications" });
    }
};

/**
 * GET /api/notifications
 * Get notifications received by the current user
 */
exports.getReceivedNotifications = async (req, res) => {
    try {
        const userId = req.user._id;

        const notifications = await Notification.find({ recipient: userId })
            .sort({ createdAt: -1 })
            .populate("sender", "name role");

        const result = notifications.map((n) => ({
            id: n._id,
            title: n.title,
            message: n.message,
            type: n.type,
            purpose: n.purpose,
            isRead: n.isRead,
            sentAt: n.createdAt,
            sender: n.sender
                ? {
                    id: n.sender._id,
                    name: n.sender.name,
                    role: n.senderRole,
                }
                : null,
            recipientRole: n.recipientRole,
        }));

        return res.json(result);
    } catch (err) {
        console.error("Error fetching received notifications:", err);
        return res.status(500).json({ message: "Failed to fetch notifications" });
    }
};

/**
 * GET /api/notifications/sent
 * Get notifications sent by the current user
 */
exports.getSentNotifications = async (req, res) => {
    try {
        const userId = req.user._id;

        const notifications = await Notification.find({ sender: userId })
            .sort({ createdAt: -1 })
            .populate("recipient", "name role");

        const result = notifications.map((n) => ({
            id: n._id,
            title: n.title,
            message: n.message,
            type: n.type,
            purpose: n.purpose,
            isRead: n.isRead,
            sentAt: n.createdAt,
            recipient: n.recipient
                ? {
                    id: n.recipient._id,
                    name: n.recipient.name,
                    role: n.recipientRole,
                }
                : null,
        }));

        return res.json(result);
    } catch (err) {
        console.error("Error fetching sent notifications:", err);
        return res.status(500).json({ message: "Failed to fetch sent notifications" });
    }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
exports.markNotificationRead = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;

        const notification = await Notification.findById(id);
        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        if (String(notification.recipient) !== String(userId)) {
            return res
                .status(403)
                .json({ message: "Not allowed to modify this notification" });
        }

        if (!notification.isRead) {
            notification.isRead = true;
            notification.readAt = new Date();
            await notification.save();
        }

        return res.json({ message: "Notification marked as read" });
    } catch (err) {
        console.error("Error marking notification as read:", err);
        return res.status(500).json({ message: "Failed to mark notification as read" });
    }
};

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications for the current user as read
 */
exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user._id;

        await Notification.updateMany(
            { recipient: userId, isRead: false },
            { $set: { isRead: true, readAt: new Date() } }
        );

        return res.json({ message: "All notifications marked as read" });
    } catch (err) {
        console.error("Error marking all notifications as read:", err);
        return res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
};

/**
 * GET /api/notifications/recipients?role=parent|teacher
 * Returns list of potential recipients for notifications.
 *
 * Permissions:
 *  - admin:   can request role=parent or role=teacher
 *  - teacher: can request role=parent only
 *  - parent:  can request role=parent only (for parent-to-parent notifications)
 */
exports.getNotificationRecipients = async (req, res) => {
    try {
        const { role } = req.query;
        const senderRole = req.user.role;

        if (!role || !["parent", "teacher"].includes(role)) {
            return res
                .status(400)
                .json({ message: "Query param 'role' must be 'parent' or 'teacher'" });
        }

        if (senderRole === "teacher" && role !== "parent") {
            return res
                .status(403)
                .json({ message: "Teachers can only load parents as recipients" });
        }

        if (senderRole === "parent" && role !== "parent") {
            return res
                .status(403)
                .json({ message: "Parents can only load other parents as recipients" });
        }

        // Admin can request both roles
        const users = await User.find({ role })
            .select("_id name role")
            .sort({ name: 1 });

        const result = users.map((u) => ({
            id: u._id,
            name: u.name,
            role: u.role,
        }));

        return res.json(result);
    } catch (err) {
        console.error("Error fetching notification recipients:", err);
        return res.status(500).json({ message: "Failed to fetch recipients" });
    }
};
