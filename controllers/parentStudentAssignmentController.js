// controllers/parentStudentAssignmentController.js
const ParentStudentAssignment = require("../models/ParentStudentAssignment");
const User = require("../models/User");

// Ensure parent exists & is of role=parent
async function assertParent(id) {
    const user = await User.findById(id);
    if (!user || user.role !== "parent")
        throw new Error("Invalid parent ID");
    return user;
}

// Ensure student exists & is role=student
async function assertStudent(id) {
    const user = await User.findById(id);
    if (!user || user.role !== "student")
        throw new Error("Invalid student ID");
    return user;
}

exports.listAssignments = async (req, res) => {
    try {
        const { parentId, studentId } = req.query;
        const filter = {};
        if (parentId) filter.parentId = parentId;
        if (studentId) filter.studentId = studentId;

        const items = await ParentStudentAssignment.find(filter)
            .populate("parentId", "name email role")
            .populate("studentId", "name email role")
            .populate("assignedBy", "name email")
            .sort({ createdAt: -1 })
            .lean();

        res.json(items);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.assignStudents = async (req, res) => {
    try {
        const { parentId, studentIds, note } = req.body;
        if (!parentId || !Array.isArray(studentIds))
            return res.status(400).json({ message: "parentId and studentIds[] required" });

        await assertParent(parentId);

        // Ensure students valid
        for (let sid of studentIds) await assertStudent(sid);

        // Ensure each student does not already have a parent
        const existing = await ParentStudentAssignment.find({
            studentId: { $in: studentIds }
        });

        if (existing.length > 0) {
            return res.status(400).json({
                message: "Some students already have a parent",
                conflicts: existing.map(x => x.studentId.toString())
            });
        }

        // Create assignments
        const docs = studentIds.map(sid => ({
            parentId,
            studentId: sid,
            assignedBy: req.user._id,
            note
        }));

        const result = await ParentStudentAssignment.insertMany(docs);
        res.json({ inserted: result.length, items: result });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.unassign = async (req, res) => {
    try {
        const { id } = req.params;
        await ParentStudentAssignment.findByIdAndDelete(id);
        res.json({ message: "Unassigned successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Return list of children for logged-in parent
exports.myChildren = async (req, res) => {
    try {
        const parentId = req.user._id.toString();

        const assignments = await ParentStudentAssignment.find({ parentId })
            .populate("studentId", "name email role")
            .lean();

        res.json(assignments.map(a => ({
            id: a._id,
            studentId: a.studentId._id,
            name: a.studentId.name,
            email: a.studentId.email
        })));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Helper used in routes that require parent-child validation
exports.parentCanAccessStudent = async (parentId, studentId) => {
    const found = await ParentStudentAssignment.findOne({ parentId, studentId });
    return !!found;
};
