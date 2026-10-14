const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');

// A seeker with known credentials, for the Selenium specs that have to log in
// as one (T12.E3, T12.E22 and the T12.5 enrollment specs once those land).
//
// seedTestNgo.js only creates a seeker when the database has none at all, so
// on a database that already has real seekers there was no account anyone knew
// the password for. This seeds one explicitly.
//
// Safe to run repeatedly.

const TEST_SEEKER = {
  name: 'Test Seeker',
  email: process.env.SEEKER_TEST_EMAIL || 'seeker@test.com',
  password: process.env.SEEKER_TEST_PASSWORD || 'Seeker@12345',
};

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  const email = TEST_SEEKER.email.toLowerCase();
  const existing = await User.findOne({ email });

  if (existing) {
    // Seekers are approved on registration, but repair it if anything drifted.
    if (existing.status !== 'approved' || existing.role !== 'seeker') {
      existing.role = 'seeker';
      existing.status = 'approved';
      await existing.save();
      console.log(`Test seeker repaired: ${existing.email}`);
    } else {
      console.log(`Test seeker already exists: ${existing.email}`);
    }
  } else {
    await User.create({
      name: TEST_SEEKER.name,
      email: TEST_SEEKER.email,
      password: await bcrypt.hash(TEST_SEEKER.password, 10),
      role: 'seeker',
      status: 'approved',
    });
    console.log(`Test seeker created: ${TEST_SEEKER.email}`);
  }

  console.log('');
  console.log('Test seeker login:');
  console.log(`  email:    ${TEST_SEEKER.email}`);
  console.log(`  password: ${TEST_SEEKER.password}`);

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});

module.exports = { TEST_SEEKER };
