
const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const allowRoles = require('../middleware/role');
const optionalAuth = require('../middleware/optionalAuth');

const {
  getResources,
  getResourceById,
  getCategories,
  createResource,
  updateResource,
  deleteResource,
  createCategory,
} = require('../controllers/resourceController');

router.get('/categories/all', getCategories);
router.post('/categories', auth, allowRoles('admin'), createCategory);

router.get('/', optionalAuth, getResources);
router.get('/:id', optionalAuth, getResourceById);

router.post('/', auth, allowRoles('admin'), createResource);
router.patch('/:id', auth, allowRoles('admin'), updateResource);
router.put('/:id', auth, allowRoles('admin'), updateResource);
router.delete('/:id', auth, allowRoles('admin'), deleteResource);

module.exports = router;