// scripts/seedAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const hasAdmin = await User.exists({ role: 'admin' });
    if (hasAdmin) {
      console.log('Admin already exists. No action taken.');
      return process.exit(0);
    }
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@happypath.local';
    const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
    const admin = new User({
      name: 'System Admin',
      email,
      password,
      role: 'admin'
    });
    await admin.save();
    console.log(`Admin created: ${email} / (set via env)`);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
