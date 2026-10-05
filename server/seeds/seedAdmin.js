const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function seed() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env first.');
  }

  await mongoose.connect(process.env.MONGO_URI);

  
  const existing = await User.findOne({
    $or: [{ role: 'admin' }, { email: ADMIN_EMAIL.toLowerCase() }],
  });

  if (existing) {
    console.log(`Admin already exists (${existing.email}), nothing created.`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await User.create({
    name: 'MindEase Admin',
    email: ADMIN_EMAIL,
    password: passwordHash,
    role: 'admin',
    status: 'approved', 
  });

  console.log(`Admin created: ${admin.email}`);
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});