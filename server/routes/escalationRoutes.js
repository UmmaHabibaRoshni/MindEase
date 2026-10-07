const express = require('express');
const auth = require('../middleware/auth');
const allowRoles = require('../middleware/role');
const {
  createEscalation,
  getPsychologists,
  getAssignedCases,
  acceptCase,
  rejectCase,
  completeCase,
} = require('../controllers/escalationController');

const router = express.Router();

router.use(auth);

// T9.4 - volunteer side
router.post('/', allowRoles('volunteer'), createEscalation);
router.get('/psychologists', allowRoles('volunteer'), getPsychologists);

// T9.5 - psychologist side
router.get('/assigned', allowRoles('psychologist'), getAssignedCases);
router.patch('/:id/accept', allowRoles('psychologist'), acceptCase);
router.patch('/:id/reject', allowRoles('psychologist'), rejectCase);
router.patch('/:id/complete', allowRoles('psychologist'), completeCase);

module.exports = router;
