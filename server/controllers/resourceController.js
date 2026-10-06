
const mongoose = require('mongoose');
const Resource = require('../models/Resource');
const ResourceCategory = require('../models/ResourceCategory');

const TYPES = ['helpline', 'article'];
const FIELDS = ['title', 'type', 'description', 'category', 'phone', 'url', 'content', 'isPublished'];

const isAdmin = (req) => req.user?.role === 'admin';
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pickFields = (body) => {
  const data = {};
  FIELDS.forEach((f) => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  return data;
};

// GET /api/resources?category=&type=&search=
exports.getResources = async (req, res) => {
  try {
    const filter = {};
    if (!isAdmin(req)) filter.isPublished = true;

    const { category, type, search } = req.query;

    if (type) {
      if (!TYPES.includes(type)) {
        return res.status(400).json({ message: 'Type must be helpline or article.' });
      }
      filter.type = type;
    }

    if (search) {
      filter.title = { $regex: escapeRegex(String(search)), $options: 'i' };
    }

    if (category) {
      if (mongoose.isValidObjectId(category)) {
        filter.category = category;
      } else {
        const cat = await ResourceCategory.findOne({
          name: { $regex: `^${escapeRegex(String(category))}$`, $options: 'i' },
        });
        if (!cat) return res.json({ count: 0, resources: [] });
        filter.category = cat._id;
      }
    }

    const resources = await Resource.find(filter).sort({ createdAt: -1 });
    res.json({ count: resources.length, resources });
  } catch (err) {
    console.error('getResources error:', err);
    res.status(500).json({ message: 'Server error while loading resources.' });
  }
};

// GET /api/resources/:id
exports.getResourceById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid resource id.' });
    }

    const resource = await Resource.findById(id);
    if (!resource || (!resource.isPublished && !isAdmin(req))) {
      return res.status(404).json({ message: 'Resource not found.' });
    }
    res.json({ resource });
  } catch (err) {
    console.error('getResourceById error:', err);
    res.status(500).json({ message: 'Server error while loading the resource.' });
  }
};

// GET /api/resources/categories/all
exports.getCategories = async (req, res) => {
  try {
    const categories = await ResourceCategory.find().sort({ name: 1 });
    res.json({ count: categories.length, categories });
  } catch (err) {
    console.error('getCategories error:', err);
    res.status(500).json({ message: 'Server error while loading categories.' });
  }
};

// POST /api/resources
exports.createResource = async (req, res) => {
  try {
    const data = pickFields(req.body);

    if (!data.title || !data.title.trim()) {
      return res.status(400).json({ message: 'Title is required.' });
    }
    if (!TYPES.includes(data.type)) {
      return res.status(400).json({ message: 'Type must be helpline or article.' });
    }
    if (data.type === 'helpline' && !data.phone) {
      return res.status(400).json({ message: 'A helpline needs a phone number.' });
    }
    if (data.type === 'article' && !data.content && !data.url) {
      return res.status(400).json({ message: 'An article needs content or a url.' });
    }
    if (!data.category || !mongoose.isValidObjectId(data.category)) {
      return res.status(400).json({ message: 'A valid category id is required.' });
    }

    data.createdBy = req.user.id;
    const resource = await Resource.create(data);
    res.status(201).json({ message: 'Resource created.', resource });
  } catch (err) {
    console.error('createResource error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error while creating the resource.' });
  }
};

// PATCH /api/resources/:id
exports.updateResource = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid resource id.' });
    }

    const data = pickFields(req.body);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update.' });
    }
    if (data.type && !TYPES.includes(data.type)) {
      return res.status(400).json({ message: 'Type must be helpline or article.' });
    }
    if (data.category && !mongoose.isValidObjectId(data.category)) {
      return res.status(400).json({ message: 'Invalid category id.' });
    }

    const resource = await Resource.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
    if (!resource) return res.status(404).json({ message: 'Resource not found.' });

    res.json({ message: 'Resource updated.', resource });
  } catch (err) {
    console.error('updateResource error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error while updating the resource.' });
  }
};

// DELETE /api/resources/:id
exports.deleteResource = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid resource id.' });
    }

    const resource = await Resource.findByIdAndDelete(id);
    if (!resource) return res.status(404).json({ message: 'Resource not found.' });

    res.json({ message: 'Resource deleted.' });
  } catch (err) {
    console.error('deleteResource error:', err);
    res.status(500).json({ message: 'Server error while deleting the resource.' });
  }
};

// POST /api/resources/categories
exports.createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required.' });
    }

    const category = await ResourceCategory.create({ name: name.trim(), description });
    res.status(201).json({ message: 'Category created.', category });
  } catch (err) {
    console.error('createCategory error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A category with this name already exists.' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error while creating the category.' });
  }
};