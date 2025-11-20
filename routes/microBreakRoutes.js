// backend/routes/microBreakRoutes.js
const express = require("express");
const MicroBreakContent = require("../models/MicroBreakContent");
const { protect, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// All routes require auth
router.use(protect);

/**
 * Public list for students – only active items, minimal fields.
 * GET /api/micro-breaks/public
 */
router.get("/public", async (_req, res) => {
    try {
        const items = await MicroBreakContent.find({ isActive: true })
            .sort({ createdAt: -1 })
            .select("_id title youtubeUrl boosterText")
            .lean();
        res.json(
            items.map((i) => ({
                id: i._id.toString(),
                title: i.title,
                youtubeUrl: i.youtubeUrl,
                boosterText: i.boosterText,
            }))
        );
    } catch (err) {
        console.error("micro-breaks/public error", err);
        res.status(500).json({ message: "Failed to load micro-break content" });
    }
});

/**
 * Teacher/Admin – list full library
 * GET /api/micro-breaks
 */
router.get(
    "/",
    requireRole("teacher", "admin"),
    async (_req, res) => {
        try {
            const items = await MicroBreakContent.find({})
                .sort({ createdAt: -1 })
                .lean();
            res.json(
                items.map((i) => ({
                    id: i._id.toString(),
                    title: i.title,
                    youtubeUrl: i.youtubeUrl,
                    boosterText: i.boosterText,
                    isActive: i.isActive,
                    createdAt: i.createdAt,
                }))
            );
        } catch (err) {
            console.error("micro-breaks list error", err);
            res.status(500).json({ message: "Failed to load micro-break content" });
        }
    }
);

/**
 * Create new item
 * POST /api/micro-breaks
 */
router.post(
    "/",
    requireRole("teacher", "admin"),
    async (req, res) => {
        try {
            const { title, youtubeUrl, boosterText } = req.body;
            if (!title || !youtubeUrl || !boosterText) {
                return res
                    .status(400)
                    .json({ message: "title, youtubeUrl and boosterText are required" });
            }

            const doc = await MicroBreakContent.create({
                title,
                youtubeUrl,
                boosterText,
                createdBy: req.user._id,
            });

            res.status(201).json({
                id: doc._id.toString(),
                title: doc.title,
                youtubeUrl: doc.youtubeUrl,
                boosterText: doc.boosterText,
                isActive: doc.isActive,
            });
        } catch (err) {
            console.error("micro-breaks create error", err);
            res.status(500).json({ message: "Failed to create micro-break content" });
        }
    }
);

/**
 * Update item
 * PUT /api/micro-breaks/:id
 */
router.put(
    "/:id",
    requireRole("teacher", "admin"),
    async (req, res) => {
        try {
            const { title, youtubeUrl, boosterText, isActive } = req.body;
            const update = {};
            if (title != null) update.title = title;
            if (youtubeUrl != null) update.youtubeUrl = youtubeUrl;
            if (boosterText != null) update.boosterText = boosterText;
            if (typeof isActive === "boolean") update.isActive = isActive;

            const doc = await MicroBreakContent.findByIdAndUpdate(
                req.params.id,
                update,
                { new: true }
            );

            if (!doc) {
                return res.status(404).json({ message: "Micro-break item not found" });
            }

            res.json({
                id: doc._id.toString(),
                title: doc.title,
                youtubeUrl: doc.youtubeUrl,
                boosterText: doc.boosterText,
                isActive: doc.isActive,
            });
        } catch (err) {
            console.error("micro-breaks update error", err);
            res.status(500).json({ message: "Failed to update micro-break content" });
        }
    }
);

/**
 * Delete item
 * DELETE /api/micro-breaks/:id
 */
router.delete(
    "/:id",
    requireRole("teacher", "admin"),
    async (req, res) => {
        try {
            const doc = await MicroBreakContent.findByIdAndDelete(req.params.id);
            if (!doc) {
                return res.status(404).json({ message: "Micro-break item not found" });
            }
            res.json({ message: "Deleted" });
        } catch (err) {
            console.error("micro-breaks delete error", err);
            res.status(500).json({ message: "Failed to delete micro-break content" });
        }
    }
);

module.exports = router;
