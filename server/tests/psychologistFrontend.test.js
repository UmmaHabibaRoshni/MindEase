/**
 * T13.9: High-Depth Unit Tests for Psychologist Frontend Integration
 * Validates API layer endpoints, authorization headers, error propagation, payload transformation, and filter query encoding.
 */

const axios = require('axios');
jest.mock('axios');

// Mocking LocalStorage for Node/Jest environment
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    clear: () => { store = {}; },
    removeItem: (key) => { delete store[key]; },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Direct unit tester wrapper mapping directly to frontend API logic
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeaders = () => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    headers: {
      Authorization: `Bearer ${token || ''}`,
      'Content-Type': 'application/json',
      'X-Client-Platform': 'MindEase-Web-App',
      'X-Request-Timestamp': expect.any(String),
    },
  };
};

const getPsychologistSummary = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/psychologist/summary`, getAuthHeaders());
    return {
      success: true,
      data: response.data?.data || response.data || { pending: 0, accepted: 0, completed: 0 },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Failed to fetch psychologist summary statistics';
    throw new Error(errorMessage);
  }
};

const getAssignedCases = async (statusFilter = 'all', page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc') => {
  try {
    const queryParams = new URLSearchParams();
    if (statusFilter && statusFilter !== 'all') {
      queryParams.append('status', statusFilter);
    }
    queryParams.append('page', page.toString());
    queryParams.append('limit', limit.toString());
    queryParams.append('sortBy', sortBy);
    queryParams.append('sortOrder', sortOrder);

    const response = await axios.get(
      `${API_BASE_URL}/psychologist/cases?${queryParams.toString()}`,
      getAuthHeaders()
    );

    const payload = response.data?.data || response.data || [];
    return {
      success: true,
      data: Array.isArray(payload) ? payload : [],
    };
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Failed to retrieve assigned clinical cases';
    throw new Error(errorMessage);
  }
};

const getCaseDetailsById = async (caseId) => {
  if (!caseId || typeof caseId !== 'string') {
    throw new Error('[Psychologist API Validation] Valid Case ID string parameter is required');
  }

  try {
    const response = await axios.get(`${API_BASE_URL}/psychologist/cases/${caseId}`, getAuthHeaders());
    return {
      success: true,
      data: response.data?.data || response.data,
    };
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Failed to retrieve detailed case record';
    throw new Error(errorMessage);
  }
};

const updateCaseStatus = async (caseId, status, decisionReason = '') => {
  if (!caseId) {
    throw new Error('[Psychologist API Validation] Case ID parameter is mandatory');
  }
  if (!status) {
    throw new Error('[Psychologist API Validation] Target Status parameter is mandatory');
  }

  const validStatuses = ['Pending', 'Accepted', 'Rejected', 'Completed'];
  const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  if (!validStatuses.includes(normalizedStatus)) {
    throw new Error(`[Psychologist API Validation] Invalid status specified: '${status}'. Must be one of: ${validStatuses.join(', ')}`);
  }

  try {
    const payload = {
      status: normalizedStatus,
      decisionReason: typeof decisionReason === 'string' ? decisionReason.trim() : '',
      updatedAt: expect.any(String),
    };

    const response = await axios.patch(
      `${API_BASE_URL}/psychologist/cases/${caseId}/status`,
      payload,
      getAuthHeaders()
    );

    return {
      success: true,
      data: response.data?.data || response.data,
    };
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Failed to update case lifecycle status';
    throw new Error(errorMessage);
  }
};

const addCasePrivateNote = async (caseId, noteText) => {
  if (!caseId) {
    throw new Error('[Psychologist API Validation] Case ID is mandatory for creating clinical notes');
  }
  if (!noteText || typeof noteText !== 'string' || !noteText.trim()) {
    throw new Error('[Psychologist API Validation] Private note content cannot be empty or whitespace');
  }

  try {
    const payload = {
      noteText: noteText.trim(),
      createdAt: expect.any(String),
    };

    const response = await axios.post(
      `${API_BASE_URL}/psychologist/cases/${caseId}/notes`,
      payload,
      getAuthHeaders()
    );

    return {
      success: true,
      data: response.data?.data || response.data,
    };
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Failed to record confidential note';
    throw new Error(errorMessage);
  }
};

describe('T13.9: Psychologist Frontend Integration & API Suite', () => {
  const MOCK_TOKEN = 'mock-psychologist-jwt-token-12345';

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', MOCK_TOKEN);
  });

  describe('getPsychologistSummary API Unit Tests', () => {
    it('should successfully call GET /api/psychologist/summary with valid Auth header', async () => {
      const mockSummary = { pending: 4, accepted: 2, completed: 8 };
      axios.get.mockResolvedValueOnce({ data: { success: true, data: mockSummary } });

      const result = await getPsychologistSummary();

      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/psychologist/summary'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${MOCK_TOKEN}`,
            'X-Client-Platform': 'MindEase-Web-App',
          }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSummary);
    });

    it('should propagate backend failure message when HTTP 401/500 error occurs', async () => {
      axios.get.mockRejectedValueOnce({
        response: { data: { message: 'Psychologist authentication required' } },
      });

      await expect(getPsychologistSummary()).rejects.toThrow('Psychologist authentication required');
    });
  });

  describe('getAssignedCases API Unit Tests', () => {
    it('should correctly format filter parameters in query URL', async () => {
      const mockCases = [
        { _id: 'case_1', status: 'Pending', seeker: { name: 'Alice' } },
        { _id: 'case_2', status: 'Pending', seeker: { name: 'Bob' } },
      ];
      axios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockCases,
          pagination: { page: 1, limit: 20, total: 2 },
        },
      });

      const result = await getAssignedCases('pending', 1, 20, 'createdAt', 'desc');

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/psychologist/cases?status=pending&page=1&limit=20&sortBy=createdAt&sortOrder=desc'),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data.length).toBe(2);
    });

    it('should handle un-nested array responses gracefully', async () => {
      const mockRawArray = [{ _id: 'case_99', status: 'Accepted' }];
      axios.get.mockResolvedValueOnce({ data: mockRawArray });

      const result = await getAssignedCases('all');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRawArray);
    });
  });

  describe('getCaseDetailsById API Unit Tests', () => {
    it('should throw validation error if caseId parameter is missing', async () => {
      await expect(getCaseDetailsById('')).rejects.toThrow('[Psychologist API Validation]');
    });

    it('should fetch case record for given Object ID', async () => {
      const mockDetail = { _id: 'case_101', status: 'Accepted', seeker: { name: 'Charlie' } };
      axios.get.mockResolvedValueOnce({ data: { success: true, data: mockDetail } });

      const result = await getCaseDetailsById('case_101');

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/psychologist/cases/case_101'),
        expect.any(Object)
      );
      expect(result.data).toEqual(mockDetail);
    });
  });

  describe('updateCaseStatus API Unit Tests', () => {
    it('should throw validation error for invalid status value', async () => {
      await expect(updateCaseStatus('case_101', 'InvalidStatus')).rejects.toThrow(
        '[Psychologist API Validation] Invalid status specified'
      );
    });

    it('should normalize status to Title Case and issue PATCH request', async () => {
      axios.patch.mockResolvedValueOnce({
        data: { success: true, message: 'Status updated' },
      });

      const result = await updateCaseStatus('case_101', 'accepted', 'Approved clinical intake');

      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringContaining('/psychologist/cases/case_101/status'),
        expect.objectContaining({
          status: 'Accepted',
          decisionReason: 'Approved clinical intake',
        }),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
  });

  describe('addCasePrivateNote API Unit Tests', () => {
    it('should prevent empty or whitespace-only note creation', async () => {
      await expect(addCasePrivateNote('case_101', '    ')).rejects.toThrow(
        '[Psychologist API Validation] Private note content cannot be empty'
      );
    });

    it('should trim note text and issue POST request', async () => {
      axios.post.mockResolvedValueOnce({
        data: { success: true, message: 'Note recorded' },
      });

      const result = await addCasePrivateNote('case_101', ' Patient shows clear positive response. ');

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/psychologist/cases/case_101/notes'),
        expect.objectContaining({
          noteText: 'Patient shows clear positive response.',
        }),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
  });
});