const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 
const User = require('../models/User');
const Ngo = require('../models/Ngo');


const NGOS = [
  {
    email: 'ngo1@example.org', contactPerson: 'Test Person 1',
    organizationName: 'Demo Mind Care Foundation', registrationNumber: 'DEMO-REG-001',
    contactPhone: '01700000001', address: 'Dhaka', categories: ['mental_health', 'substance_use'],
  },
  {
    email: 'ngo2@example.org', contactPerson: 'Test Person 2',
    organizationName: 'Demo Safe Home', registrationNumber: 'DEMO-REG-002',
    contactPhone: '01700000002', address: 'Chattogram', categories: ['abuse_violence', 'legal_aid'],
  },
  {
    email: 'ngo3@example.org', contactPerson: 'Test Person 3',
    organizationName: 'Demo Health Aid', registrationNumber: 'DEMO-REG-003',
    contactPhone: '01700000003', address: 'Sylhet', categories: ['medical', 'other'],
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  const passwordHash = await bcrypt.hash('Ngo@12345', 10);

  for (const n of NGOS) {
    let user = await User.findOne({ email: n.email });
    if (!user) {
      user = await User.create({
        name: n.contactPerson,
        email: n.email,
        password: passwordHash,
        phone: n.contactPhone,
        role: 'ngo',
        status: 'approved',
      });
    }

    await Ngo.findOneAndUpdate(
      { registrationNumber: n.registrationNumber },
      {
        user: user._id,
        organizationName: n.organizationName,
        contactPhone: n.contactPhone,
        contactEmail: n.email,
        address: n.address,
        categories: n.categories,
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    console.log(`Seeded: ${n.organizationName}`);
  }

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});