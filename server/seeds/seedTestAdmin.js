const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');

// A second admin with a known password, for the Selenium specs that have to
// log in as an admin (T8.E1, T11.E3).
//
// seedAdmin.js refuses to run once any admin exists, and the original
// admin@mindease.com password is bcrypt-hashed and cannot be recovered by
// anyone. Rather than reset that shared account and lock out whoever uses it,
// this adds a separate test admin and leaves the original untouched.
//
// Safe to run repeatedly.

const TEST_ADMIN = {
  name: 'Test Admin',
  email: process.env.ADMIN_TEST_EMAIL || 'admin.test@mindease.com',
  password: process.env.ADMIN_TEST_PASSWORD || 'Admin@12345',
};

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  const email = TEST_ADMIN.email.toLowerCase();
  const existing = await User.findOne({ email });

  if (existing) {
    if (existing.status !== 'approved' || existing.role !== 'admin') {
      existing.role = 'admin';
      existing.status = 'approved';
      await existing.save();
      console.log(`Test admin repaired: ${existing.email}`);
    } else {
      console.log(`Test admin already exists: ${existing.email}`);
    }
  } else {
    await User.create({
      name: TEST_ADMIN.name,
      email: TEST_ADMIN.email,
      password: await bcrypt.hash(TEST_ADMIN.password, 10),
      role: 'admin',
      status: 'approved',
    });
    console.log(`Test admin created: ${TEST_ADMIN.email}`);
  }

  console.log('');
  console.log('Test admin login:');
  console.log(`  email:    ${TEST_ADMIN.email}`);
  console.log(`  password: ${TEST_ADMIN.password}`);
  console.log('(the original admin@mindease.com account is untouched)');

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});

module.exports = { TEST_ADMIN };
