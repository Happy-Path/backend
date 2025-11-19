// backend/routes/teacher.js
const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/authMiddleware");
const roleGuard = require("../middleware/roleGuard");
const Session = require("../models/Session");

const router = express.Router();
router.use(protect);

/**
 * GET /api/teacher/students
 *
 * Returns a summary list of students who have been active in the last N days
 * (default: 90), including:
 *  - userId
 *  - name, email
 *  - lastActive
 *  - progressPercent (average percent across lessons)
 *  - completedModules (progress.completed === true)
 *  - totalModules (number of progress docs)
 *
 * NOTE: This is not yet restricted to "teacher's own" students because
 * teacher–student linkage is not defined in the schema. It shows all active students.
 */
router.get("/students", roleGuard(["teacher"]), async (req, res) => {
    try {
        const { days = 90 } = req.query;
        const since = new Date(Date.now() - Number(days) * 24 * 3600 * 1000);

        const agg = await Session.aggregate([
            // only sessions since "since"
            {
                $match: {
                    startedAt: { $gte: since },
                },
            },
            // group by learner
            {
                $group: {
                    _id: "$userId",
                    lastSession: { $max: "$startedAt" },
                },
            },
            // join to users
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: "$user" },
            // only real students
            {
                $match: {
                    "user.role": "student",
                },
            },
            // join to progresses to compute completion stats
            {
                $lookup: {
                    from: "progresses",
                    localField: "_id",
                    foreignField: "userId",
                    as: "progressDocs",
                },
            },
            {
                $addFields: {
                    completedModules: {
                        $size: {
                            $filter: {
                                input: "$progressDocs",
                                as: "p",
                                cond: { $eq: ["$$p.completed", true] },
                            },
                        },
                    },
                    totalModules: { $size: "$progressDocs" },
                    avgPercent: {
                        $cond: [
                            { $gt: [{ $size: "$progressDocs" }, 0] },
                            { $avg: "$progressDocs.percent" },
                            0,
                        ],
                    },
                },
            },
            {
                $project: {
                    userId: "$_id",
                    lastActive: "$lastSession",
                    name: "$user.name",
                    email: "$user.email",
                    completedModules: 1,
                    totalModules: 1,
                    avgPercent: 1,
                },
            },
            { $sort: { lastActive: -1 } },
        ]);

        const result = agg.map((x) => ({
            userId: x.userId?.toString(),
            name: x.name || x.email || x.userId?.toString(),
            email: x.email || "",
            lastActive: x.lastActive,
            progressPercent: Math.round(x.avgPercent || 0),
            completedModules: x.completedModules || 0,
            totalModules: x.totalModules || 0,
        }));

        res.json(result);
    } catch (err) {
        console.error("GET /teacher/students failed:", err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
