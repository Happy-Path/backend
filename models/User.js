// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: true },
  role: {
    type: String,
    required: true,
    enum: ['student', 'parent', 'teacher', 'admin'],
    default: 'student',
    index: true
  },
  avatar: { type: String, default: '/placeholder.svg' },

  guardianConsent: { given: { type: Boolean, default: false }, at: Date },
  children: [{ type: mongoose.Types.ObjectId, ref: 'User' }],
  students: [{ type: mongoose.Types.ObjectId, ref: 'User' }],

  // NEW
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date },
  createdBy: { type: mongoose.Types.ObjectId, ref: 'User' }, // who created this account
  updatedBy: { type: mongoose.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

userSchema.set('toJSON', {
  transform: (doc, ret) => { delete ret.password; delete ret.__v; return ret; }
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.comparePassword = userSchema.methods.matchPassword;

const User = mongoose.model('User', userSchema);
module.exports = User;
