const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const PSYCHOLOGIST_EMAIL =
  process.env.PSYCHOLOGIST_EMAIL || 'psychologist@mindease.test';
const PSYCHOLOGIST_PASSWORD =
  process.env.PSYCHOLOGIST_PASSWORD || 'Psychologist@123';

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({
    email: PSYCHOLOGIST_EMAIL.toLowerCase(),
  });

  if (existing) {
    console.log(
      `Psychologist already exists (${existing.email}), nothing created.`
    );
    await mongoose.disconnect();
    return;
  }

  
  const admin = await User.findOne({ role: 'admin' });

  const passwordHash = await bcrypt.hash(PSYCHOLOGIST_PASSWORD, 10);

  const psychologist = await User.create({
    name: 'Test Psychologist',
    email: PSYCHOLOGIST_EMAIL,
    password: passwordHash,
    role: 'psychologist',
    status: 'approved',
    verifiedBy: admin ? admin._id : null,
    verifiedAt: new Date(),
  });

  console.log(`Psychologist created: ${psychologist.email}`);
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});