const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const CrisisRequest = require('../models/CrisisRequest');
const CaseAssignment = require('../models/CaseAssignment');

// Creates ONE new pending case assigned to the test psychologist, so the
// Selenium spec C5.6 (psychologist accepts a case, adds a note, completes it)
// always has a Pending case to work with.
//
// Run it before every run of that spec. Each run adds a fresh case.

const PSYCHOLOGIST_EMAIL = (
  process.env.PSYCHOLOGIST_EMAIL || 'psychologist@mindease.test'
).toLowerCase();

const TEST_SEEKER = {
  name: 'Test Seeker',
  email: (process.env.SEEKER_TEST_EMAIL || 'seeker@test.com').toLowerCase(),
  password: process.env.SEEKER_TEST_PASSWORD || 'Seeker@12345',
};

const TEST_VOLUNTEER = {
  name: 'Test Volunteer',
  email: (process.env.VOLUNTEER_TEST_EMAIL || 'volunteer@test.com').toLowerCase(),
  password: process.env.VOLUNTEER_TEST_PASSWORD || 'Volunteer@12345',
};

async function findOrCreateUser({ name, email, password }, role) {
  let user = await User.findOne({ email });
  if (user) {
    if (user.role !== role || user.status !== 'approved') {
      user.role = role;
      user.status = 'approved';
      await user.save();
      console.log(`Repaired ${role}: ${email}`);
    }
    return user;
  }

  user = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 10),
    role,
    status: 'approved',
  });
  console.log(`Created ${role}: ${email}`);
  return user;
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  const psychologist = await User.findOne({
    email: PSYCHOLOGIST_EMAIL,
    role: 'psychologist',
  });
  if (!psychologist) {
    throw new Error(
      `Psychologist ${PSYCHOLOGIST_EMAIL} not found. Run: node seeds/seedPsychologist.js`
    );
  }

  const seeker = await findOrCreateUser(TEST_SEEKER, 'seeker');
  const volunteer = await findOrCreateUser(TEST_VOLUNTEER, 'volunteer');

  const crisisRequest = await CrisisRequest.create({
    seeker: seeker._id,
    category: 'mental_health',
    description: 'Seeded request for the Selenium psychologist case test.',
    urgency: 'high',
    status: 'escalated',
    acceptedBy: volunteer._id,
  });

  const assignment = await CaseAssignment.create({
    request: crisisRequest._id,
    volunteer: volunteer._id,
    psychologist: psychologist._id,
    summary: 'Seeded handover: seeker needs a follow-up session with a psychologist.',
    status: 'pending',
  });

  console.log('');
  console.log('Pending case created for the test psychologist.');
  console.log(`  case id:      ${assignment._id}`);
  console.log(`  psychologist: ${psychologist.email}`);
  console.log(`  seeker:       ${seeker.email}`);
  console.log(`  volunteer:    ${volunteer.email} / ${TEST_VOLUNTEER.password}`);

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});