const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Ngo = require('../models/Ngo');
const Referral = require('../models/Referral');
const CrisisRequest = require('../models/CrisisRequest');

// T14.2 - one known NGO login, linked to an NGO profile, for testing BL-14.
//
// seedNgos.js already seeds three demo NGOs. This script is deliberately
// separate: it owns a single account with fixed credentials that the unit
// tests, Thunder Client collection and Selenium suite can rely on, and it
// uses its own registration number so the two seeds never collide.
//
// Safe to run repeatedly - every write is an upsert or a guarded create.

const TEST_NGO = {
  email: process.env.NGO_TEST_EMAIL || 'ngo@test.com',
  password: process.env.NGO_TEST_PASSWORD || 'Ngo@12345',
  contactPerson: 'Test NGO Officer',
  organizationName: 'Test NGO Organisation',
  registrationNumber: 'TEST-REG-001',
  contactPhone: '01700000099',
  address: 'Dhaka',
  categories: ['mental_health', 'abuse_violence'],
};

async function ensureUser() {
  let user = await User.findOne({ email: TEST_NGO.email.toLowerCase() });

  if (user) {
    console.log(`User already exists: ${user.email}`);
    return user;
  }

  user = await User.create({
    name: TEST_NGO.contactPerson,
    email: TEST_NGO.email,
    password: await bcrypt.hash(TEST_NGO.password, 10),
    phone: TEST_NGO.contactPhone,
    role: 'ngo',
    status: 'approved', // skip admin verification for the test account
  });

  console.log(`User created: ${user.email}`);
  return user;
}

async function ensureProfile(user) {
  const ngo = await Ngo.findOneAndUpdate(
    { registrationNumber: TEST_NGO.registrationNumber },
    {
      user: user._id,
      organizationName: TEST_NGO.organizationName,
      contactPhone: TEST_NGO.contactPhone,
      contactEmail: TEST_NGO.email,
      address: TEST_NGO.address,
      categories: TEST_NGO.categories,
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  console.log(`Profile ready: ${ngo.organizationName} (${ngo.registrationNumber})`);
  return ngo;
}

// The NGO dashboard is empty without one, and T14.1 assumes a referral exists.
async function ensureReferral(ngo) {
  const existing = await Referral.findOne({ ngo: ngo._id });
  if (existing) {
    console.log(`Referral already exists (status: ${existing.status})`);
    return existing;
  }

  let seeker = await User.findOne({ role: 'seeker' });
  if (!seeker) {
    seeker = await User.create({
      name: 'Test Seeker',
      email: 'seeker@test.com',
      password: await bcrypt.hash('Seeker@12345', 10),
      role: 'seeker',
      status: 'approved',
    });
    console.log(`Seeker created: ${seeker.email}`);
  }

  let volunteer = await User.findOne({ role: 'volunteer', status: 'approved' });
  if (!volunteer) {
    volunteer = await User.create({
      name: 'Test Volunteer',
      email: 'volunteer@test.com',
      password: await bcrypt.hash('Test@1234', 10),
      role: 'volunteer',
      status: 'approved',
    });
    console.log(`Volunteer created: ${volunteer.email}`);
  }

  const request = await CrisisRequest.create({
    seeker: seeker._id,
    category: 'mental_health',
    description: 'Seeded request used to demonstrate the NGO referral dashboard.',
    urgency: 'medium',
    status: 'referred',
    acceptedBy: volunteer._id,
  });

  const referral = await Referral.create({
    request: request._id,
    referredBy: volunteer._id,
    ngo: ngo._id,
    consentGiven: true,
    consentAt: new Date(),
  });

  console.log(`Referral created for ${ngo.organizationName} (status: ${referral.status})`);
  return referral;
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  const user = await ensureUser();
  const ngo = await ensureProfile(user);
  await ensureReferral(ngo);

  console.log('');
  console.log('Test NGO login:');
  console.log(`  email:    ${TEST_NGO.email}`);
  console.log(`  password: ${TEST_NGO.password}`);

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});

module.exports = { TEST_NGO };
