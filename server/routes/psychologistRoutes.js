const express = require('express');
const auth = require('../middleware/auth');
const allowRoles = require('../middleware/role');
const {
  getDashboardSummary,
  listCases,
  updateCaseStatus,
  getCaseDetail,
  addCaseNote,
  listCaseNotes,
} = require('../controllers/psychologistController');

const router = express.Router();

// Every route here is for an approved psychologist.
router.use(auth, allowRoles('psychologist'));

// T13.5
router.get('/summary', getDashboardSummary);

// Dashboard case list and accept / reject / complete.
// '/cases' is declared before '/cases/:id' so the literal path always wins.
router.get('/cases', listCases);
router.patch('/cases/:id/status', updateCaseStatus);

// T13.4
router.get('/cases/:id', getCaseDetail);
router.post('/cases/:id/notes', addCaseNote);
router.get('/cases/:id/notes', listCaseNotes);

module.exports = router;
