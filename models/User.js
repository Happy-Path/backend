// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,            // normalize
        trim: true
    },

    password: { type: String, required: true, select: true }, // stored hashed

    role: {
        type: String,
        required: true,
        enum: ['student', 'parent', 'teacher'],
        default: 'student',
        index: true
    },

    avatar: { type: String, default: '/placeholder.svg' },

    // ✅ optional but useful for your use-case (<12, home use)
    guardianConsent: {
        given: { type: Boolean, default: false },
        at: Date
    },

    // ✅ optional relationships (enables parent/teacher to view learners)
    children: [{ type: mongoose.Types.ObjectId, ref: 'User' }],     // for parents
    students: [{ type: mongoose.Types.ObjectId, ref: 'User' }],     // for teachers
}, { timestamps: true });

// Hide sensitive fields when sending to client
userSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
    }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare passwords
userSchema.methods.matchPassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

// (Optional) helper alias
userSchema.methods.comparePassword = userSchema.methods.matchPassword;

const User = mongoose.model('User', userSchema);
module.exports = User;
