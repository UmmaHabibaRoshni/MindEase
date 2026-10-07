
jest.mock('../models/Resource', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

jest.mock('../models/ResourceCategory', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../middleware/auth', () => jest.fn());

const Resource = require('../models/Resource');
const ResourceCategory = require('../models/ResourceCategory');
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

const adminId = '507f1f77bcf86cd799439011';
const resourceId = '507f1f77bcf86cd799439012';
const categoryId = '507f1f77bcf86cd799439013';

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function findReturns(list) {
  Resource.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(list) });
}

const admin = { id: adminId, role: 'admin' };

describe('getResources', () => {
  test('a guest sees only published resources', async () => {
    findReturns([]);
    await getResources({ query: {} }, mockRes());
    expect(Resource.find).toHaveBeenCalledWith({ isPublished: true });
  });

  test('an admin sees all resources', async () => {
    findReturns([]);
    await getResources({ query: {}, user: admin }, mockRes());
    expect(Resource.find).toHaveBeenCalledWith({});
  });

  test('returns the list with a count', async () => {
    const list = [{ title: 'A' }, { title: 'B' }];
    findReturns(list);
    const res = mockRes();
    await getResources({ query: {} }, res);
    expect(res.json).toHaveBeenCalledWith({ count: 2, resources: list });
  });

  test('filters by a valid type', async () => {
    findReturns([]);
    await getResources({ query: { type: 'helpline' } }, mockRes());
    expect(Resource.find).toHaveBeenCalledWith({ isPublished: true, type: 'helpline' });
  });

  test('rejects an invalid type with 400', async () => {
    const res = mockRes();
    await getResources({ query: { type: 'video' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Resource.find).not.toHaveBeenCalled();
  });

  test('search text is escaped before it is used as a regex', async () => {
    findReturns([]);
    await getResources({ query: { search: 'a.b' } }, mockRes());
    const filter = Resource.find.mock.calls[0][0];
    expect(filter.title.$regex).toBe('a\\.b');
  });

  test('filters by category id', async () => {
    findReturns([]);
    await getResources({ query: { category: categoryId } }, mockRes());
    expect(Resource.find).toHaveBeenCalledWith({ isPublished: true, category: categoryId });
  });

  test('filters by category name', async () => {
    ResourceCategory.findOne.mockResolvedValue({ _id: categoryId });
    findReturns([]);
    await getResources({ query: { category: 'Crisis Support' } }, mockRes());
    expect(Resource.find).toHaveBeenCalledWith({ isPublished: true, category: categoryId });
  });

  test('an unknown category name returns an empty list', async () => {
    ResourceCategory.findOne.mockResolvedValue(null);
    const res = mockRes();
    await getResources({ query: { category: 'Nothing' } }, res);
    expect(res.json).toHaveBeenCalledWith({ count: 0, resources: [] });
    expect(Resource.find).not.toHaveBeenCalled();
  });

  test('returns 500 when the database fails', async () => {
    Resource.find.mockImplementation(() => {
      throw new Error('db down');
    });
    const res = mockRes();
    await getResources({ query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getResourceById', () => {
  test('returns 400 for an invalid id', async () => {
    const res = mockRes();
    await getResourceById({ params: { id: 'nope' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when the resource does not exist', async () => {
    Resource.findById.mockResolvedValue(null);
    const res = mockRes();
    await getResourceById({ params: { id: resourceId } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('hides an unpublished resource from a guest', async () => {
    Resource.findById.mockResolvedValue({ isPublished: false });
    const res = mockRes();
    await getResourceById({ params: { id: resourceId } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('shows an unpublished resource to an admin', async () => {
    const resource = { isPublished: false, title: 'Draft' };
    Resource.findById.mockResolvedValue(resource);
    const res = mockRes();
    await getResourceById({ params: { id: resourceId }, user: admin }, res);
    expect(res.json).toHaveBeenCalledWith({ resource });
  });

  test('shows a published resource to a guest', async () => {
    const resource = { isPublished: true, title: 'Public' };
    Resource.findById.mockResolvedValue(resource);
    const res = mockRes();
    await getResourceById({ params: { id: resourceId } }, res);
    expect(res.json).toHaveBeenCalledWith({ resource });
  });
});

describe('getCategories', () => {
  test('returns all categories with a count', async () => {
    const categories = [{ name: 'A' }, { name: 'B' }];
    ResourceCategory.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(categories) });
    const res = mockRes();
    await getCategories({}, res);
    expect(res.json).toHaveBeenCalledWith({ count: 2, categories });
  });
});

describe('createResource', () => {
  const validHelpline = {
    title: 'National Helpline',
    type: 'helpline',
    description: 'Free support',
    category: categoryId,
    phone: '16789',
  };

  test('requires a title', async () => {
    const res = mockRes();
    await createResource({ body: { ...validHelpline, title: ' ' }, user: admin }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('requires a valid type', async () => {
    const res = mockRes();
    await createResource({ body: { ...validHelpline, type: 'video' }, user: admin }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('a helpline needs a phone number', async () => {
    const res = mockRes();
    await createResource({ body: { ...validHelpline, phone: undefined }, user: admin }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('an article needs content or a url', async () => {
    const res = mockRes();
    const body = { ...validHelpline, type: 'article', phone: undefined };
    await createResource({ body, user: admin }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('requires a valid category id', async () => {
    const res = mockRes();
    await createResource({ body: { ...validHelpline, category: 'bad' }, user: admin }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Resource.create).not.toHaveBeenCalled();
  });

  test('creates a resource and sets createdBy from the logged-in admin', async () => {
    Resource.create.mockResolvedValue({ _id: resourceId, ...validHelpline });
    const res = mockRes();
    const body = { ...validHelpline, createdBy: 'someone-else' };

    await createResource({ body, user: admin }, res);

    expect(Resource.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'National Helpline', createdBy: adminId })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('returns 400 on a database validation error', async () => {
    const err = new Error('invalid');
    err.name = 'ValidationError';
    Resource.create.mockRejectedValue(err);
    const res = mockRes();
    await createResource({ body: validHelpline, user: admin }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('updateResource', () => {
  test('returns 400 for an invalid id', async () => {
    const res = mockRes();
    await updateResource({ params: { id: 'nope' }, body: { title: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when there are no valid fields', async () => {
    const res = mockRes();
    await updateResource({ params: { id: resourceId }, body: { createdBy: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 for an invalid type', async () => {
    const res = mockRes();
    await updateResource({ params: { id: resourceId }, body: { type: 'video' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when the resource does not exist', async () => {
    Resource.findByIdAndUpdate.mockResolvedValue(null);
    const res = mockRes();
    await updateResource({ params: { id: resourceId }, body: { title: 'New' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('updates the resource and runs validators', async () => {
    const updated = { _id: resourceId, title: 'New' };
    Resource.findByIdAndUpdate.mockResolvedValue(updated);
    const res = mockRes();

    await updateResource({ params: { id: resourceId }, body: { title: 'New' } }, res);

    expect(Resource.findByIdAndUpdate).toHaveBeenCalledWith(
      resourceId,
      { title: 'New' },
      { new: true, runValidators: true }
    );
    expect(res.json).toHaveBeenCalledWith({ message: 'Resource updated.', resource: updated });
  });
});

describe('deleteResource', () => {
  test('returns 400 for an invalid id', async () => {
    const res = mockRes();
    await deleteResource({ params: { id: 'nope' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when the resource does not exist', async () => {
    Resource.findByIdAndDelete.mockResolvedValue(null);
    const res = mockRes();
    await deleteResource({ params: { id: resourceId } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('deletes the resource', async () => {
    Resource.findByIdAndDelete.mockResolvedValue({ _id: resourceId });
    const res = mockRes();
    await deleteResource({ params: { id: resourceId } }, res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Resource deleted.' });
  });
});

describe('createCategory', () => {
  test('requires a name', async () => {
    const res = mockRes();
    await createCategory({ body: { name: '  ' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('creates a category with a trimmed name', async () => {
    ResourceCategory.create.mockResolvedValue({ name: 'Crisis Support' });
    const res = mockRes();
    await createCategory({ body: { name: ' Crisis Support ', description: 'Urgent' } }, res);
    expect(ResourceCategory.create).toHaveBeenCalledWith({
      name: 'Crisis Support',
      description: 'Urgent',
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('returns 409 for a duplicate name', async () => {
    ResourceCategory.create.mockRejectedValue({ code: 11000 });
    const res = mockRes();
    await createCategory({ body: { name: 'Crisis Support' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('role guard on resource writes', () => {
  test('lets an admin through', () => {
    const next = jest.fn();
    allowRoles('admin')({ user: { role: 'admin' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('blocks a volunteer with 403', () => {
    const next = jest.fn();
    const res = mockRes();
    allowRoles('admin')({ user: { role: 'volunteer' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('optionalAuth', () => {
  test('lets a guest through without calling auth', () => {
    const next = jest.fn();
    optionalAuth({ headers: {} }, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(auth).not.toHaveBeenCalled();
  });

  test('passes a request with a token to auth', () => {
    const next = jest.fn();
    const req = { headers: { authorization: 'Bearer abc' } };
    const res = mockRes();
    optionalAuth(req, res, next);
    expect(auth).toHaveBeenCalledWith(req, res, next);
  });
});