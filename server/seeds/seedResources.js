const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const ResourceCategory = require('../models/ResourceCategory');
const Resource = require('../models/Resource');
const User = require('../models/User');


const CATEGORIES = [
  { name: 'Mental Health', description: 'Support for mental health and emotional wellbeing.' },
  { name: 'Abuse / Violence', description: 'Help for people facing abuse or violence.' },
  { name: 'Legal Aid', description: 'Legal help and guidance.' },
  { name: 'Medical', description: 'Medical help and health services.' },
  { name: 'Substance Use', description: 'Support for substance use problems.' },
  { name: 'Other', description: 'Other support resources.' },
];


const RESOURCES = [];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  let categoriesCreated = 0;
  for (const cat of CATEGORIES) {
    const existing = await ResourceCategory.findOne({ name: cat.name });
    if (!existing) {
      await ResourceCategory.create(cat);
      categoriesCreated += 1;
    }
  }

  const admin = await User.findOne({ role: 'admin' });

  let resourcesCreated = 0;
  for (const item of RESOURCES) {
    const category = await ResourceCategory.findOne({ name: item.category });
    if (!category) {
      throw new Error(`Category "${item.category}" not found for "${item.title}".`);
    }

    const existing = await Resource.findOne({ title: item.title, type: item.type });
    if (existing) continue;

    await Resource.create({
      ...item,
      category: category._id,
      createdBy: admin ? admin._id : undefined,
    });
    resourcesCreated += 1;
  }

  console.log(
    `Categories created: ${categoriesCreated}, resources created: ${resourcesCreated}.`
  );
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
