const User = require('../models/User');

// Create ANY user (including admin). Admin-only route.
exports.adminCreateUser = async (req, res) => {
  const { name, email, password, role = 'student' } = req.body;
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, password are required' });
    }
    if (!['student', 'parent', 'teacher', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: 'Email already exists' });

    const user = new User({
      name, email, password, role,
      createdBy: req.user._id, updatedBy: req.user._id
    });
    await user.save();

    res.status(201).json({ message: 'User created', user: user.toJSON() });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// List users with basic filters & pagination
exports.adminListUsers = async (req, res) => {
  try {
    const { role, q, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (q) filter.$or = [
      { name: new RegExp(q, 'i') },
      { email: new RegExp(q, 'i') }
    ];

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(filter)
    ]);

    res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Update a user's role (kept for completeness)
exports.adminUpdateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['student', 'parent', 'teacher', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const user = await User.findByIdAndUpdate(
        id,
        { role, updatedBy: req.user._id },
        { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Role updated', user });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Enable / disable account
exports.adminToggleActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body; // boolean
    const user = await User.findByIdAndUpdate(
        id,
        { isActive: !!isActive, updatedBy: req.user._id },
        { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Account status updated', user });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// NEW: Update basic fields (name/email/isActive)
exports.adminUpdateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    if (typeof req.body.name === 'string') updates.name = req.body.name;
    if (typeof req.body.email === 'string') updates.email = req.body.email;
    if (typeof req.body.isActive === 'boolean') updates.isActive = req.body.isActive;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // If email is changing, check uniqueness
    if (updates.email) {
      const exists = await User.findOne({ email: updates.email, _id: { $ne: id } });
      if (exists) return res.status(409).json({ message: 'Email already in use' });
    }

    updates.updatedBy = req.user._id;

    const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User updated', user });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Reset user password to "password123"
exports.adminResetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = 'password123'; // hashed by pre('save')
    user.updatedBy = req.user._id;
    await user.save();

    res.json({ message: 'Password reset to default for this user' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
