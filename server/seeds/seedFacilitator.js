const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');

// Prerequisite for T12.11 (Selenium: facilitator creates a workshop).
//
// Facilitators register as "pending" and cannot log in until an admin approves
// them, and no Sprint 4 task creates one. Rather than making every tester click
// through the admin Verifications page first, this seeds one approved
// facilitator with fixed credentials.
//
// Safe to run repeatedly.

const TEST_FACILITATOR = {
  name: 'Test Facilitator',
  email: process.env.FACILITATOR_TEST_EMAIL || 'facilitator@test.com',
  password: process.env.FACILITATOR_TEST_PASSWORD || 'Facilitator@12345',
  phone: '01700000088',
};

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  const email = TEST_FACILITATOR.email.toLowerCase();
  let user = await User.findOne({ email });

  if (user) {
    // An earlier run, or a manual registration, may have left it pending.
    if (user.status !== 'approved') {
      user.status = 'approved';
      await user.save();
      console.log(`Facilitator approved: ${user.email}`);
    } else {
      console.log(`Facilitator already exists: ${user.email}`);
    }
  } else {
    user = await User.create({
      name: TEST_FACILITATOR.name,
      email: TEST_FACILITATOR.email,
      password: await bcrypt.hash(TEST_FACILITATOR.password, 10),
      phone: TEST_FACILITATOR.phone,
      role: 'facilitator',
      status: 'approved', // skip admin verification for the test account
    });
    console.log(`Facilitator created: ${user.email}`);
  }

  console.log('');
  console.log('Test facilitator login:');
  console.log(`  email:    ${TEST_FACILITATOR.email}`);
  console.log(`  password: ${TEST_FACILITATOR.password}`);

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});

module.exports = { TEST_FACILITATOR };
