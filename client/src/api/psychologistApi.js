import axios from 'axios';

/**
 * MindEase Tele-Health Platform - Psychologist API Integration Engine
 * Provides network endpoints for managing psychologist clinical workflows, 
 * retrieving patient cases, logging encrypted session notes, and modifying case statuses.
 */

const API_BASE_URL = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) 
  ? process.env.REACT_APP_API_URL 
  : 'http://localhost:5000/api';

/**
 * Constructs standardized HTTP Authorization and Client tracking headers
 * @returns {Object} Request configuration header object containing Bearer token
 */
const getAuthHeaders = () => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) {
    console.warn('[Psychologist API] Authorization token missing from storage. Operations may fail with 401.');
  }
  return {
    headers: {
      Authorization: `Bearer ${token || ''}`,
      'Content-Type': 'application/json',
      'X-Client-Platform': 'MindEase-Web-App',
      'X-Request-Timestamp': new Date().toISOString(),
    },
  };
};

/**
 * Fetches dashboard summary counts (pending, accepted, completed) for the logged-in psychologist.
 * Aligns with backend route /api/psychologist/summary
 * 
 * @returns {Promise<Object>} Formatted API payload with counts and timestamp
 */
export const getPsychologistSummary = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/psychologist/summary`, getAuthHeaders());
    return {
      success: true,
      data: response.data?.data || response.data || { pending: 0, accepted: 0, completed: 0 },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Psychologist API Service Error] getPsychologistSummary failure:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    const errorMessage = error.response?.data?.message || 'Failed to fetch psychologist summary statistics';
    throw new Error(errorMessage);
  }
};

/**
 * Retrieves paginated and status-filtered clinical cases assigned to the current psychologist
 * 
 * @param {string} statusFilter - Filter criteria ('all', 'pending', 'accepted', 'completed', 'rejected')
 * @param {number} page - Current page index (Default: 1)
 * @param {number} limit - Items per page limit (Default: 20)
 * @param {string} sortBy - Property name to sort by (Default: 'createdAt')
 * @param {string} sortOrder - Sort direction ('asc' | 'desc')
 * @returns {Promise<Object>} Paginated case directory list
 */
export const getAssignedCases = async (
  statusFilter = 'all',
  page = 1,
  limit = 20,
  sortBy = 'createdAt',
  sortOrder = 'desc'
) => {
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
    const meta = response.data?.pagination || {
      page: Number(page),
      limit: Number(limit),
      total: Array.isArray(payload) ? payload.length : 0,
      totalPages: Math.ceil((Array.isArray(payload) ? payload.length : 0) / limit) || 1,
    };

    return {
      success: true,
      data: Array.isArray(payload) ? payload : [],
      pagination: meta,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Psychologist API Service Error] getAssignedCases failure:', {
      statusFilter,
      error: error.message,
      response: error.response?.data,
    });
    const errorMessage = error.response?.data?.message || 'Failed to retrieve assigned clinical cases';
    throw new Error(errorMessage);
  }
};

/**
 * Retrieves comprehensive detail records for a single assigned clinical case by ID
 * 
 * @param {string} caseId - Unique MongoDB Case ObjectId
 * @returns {Promise<Object>} Deep case object including seeker context and volunteer handovers
 */
export const getCaseDetailsById = async (caseId) => {
  if (!caseId || typeof caseId !== 'string') {
    throw new Error('[Psychologist API Validation] Valid Case ID string parameter is required');
  }

  try {
    const response = await axios.get(`${API_BASE_URL}/psychologist/cases/${caseId}`, getAuthHeaders());
    return {
      success: true,
      data: response.data?.data || response.data,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[Psychologist API Service Error] getCaseDetailsById failure for ID ${caseId}:`, {
      message: error.message,
      response: error.response?.data,
    });
    const errorMessage = error.response?.data?.message || 'Failed to retrieve detailed case record';
    throw new Error(errorMessage);
  }
};

/**
 * Updates case status lifecycle (Pending -> Accepted/Rejected or Accepted -> Completed)
 * 
 * @param {string} caseId - Target Case Object ID
 * @param {string} status - Target status string ('Accepted', 'Rejected', 'Completed')
 * @param {string} decisionReason - Optional clinical justification note
 * @returns {Promise<Object>} Resulting updated case state
 */
export const updateCaseStatus = async (caseId, status, decisionReason = '') => {
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
      updatedAt: new Date().toISOString(),
    };

    const response = await axios.patch(
      `${API_BASE_URL}/psychologist/cases/${caseId}/status`,
      payload,
      getAuthHeaders()
    );

    return {
      success: true,
      data: response.data?.data || response.data,
      message: `Case lifecycle status successfully transitioned to ${normalizedStatus}`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[Psychologist API Service Error] updateCaseStatus failure for Case ${caseId}:`, {
      targetStatus: normalizedStatus,
      error: error.message,
      response: error.response?.data,
    });
    const errorMessage = error.response?.data?.message || 'Failed to update case lifecycle status';
    throw new Error(errorMessage);
  }
};

/**
 * Retrieves all confidential private notes logged for a specific case
 * 
 * @param {string} caseId - Target Case Object ID
 * @returns {Promise<Object>} Collection of private psychologist notes
 */
export const getCasePrivateNotes = async (caseId) => {
  if (!caseId) {
    throw new Error('[Psychologist API Validation] Case ID is required to fetch confidential notes');
  }

  try {
    const response = await axios.get(
      `${API_BASE_URL}/psychologist/cases/${caseId}/notes`,
      getAuthHeaders()
    );

    const notesList = response.data?.data || response.data || [];

    return {
      success: true,
      data: Array.isArray(notesList) ? notesList : [],
      count: Array.isArray(notesList) ? notesList.length : 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[Psychologist API Service Error] getCasePrivateNotes failure for Case ${caseId}:`, {
      error: error.message,
      response: error.response?.data,
    });
    const errorMessage = error.response?.data?.message || 'Failed to fetch private clinical notes';
    throw new Error(errorMessage);
  }
};

/**
 * Adds an encrypted private clinical observation note to a specific case
 * 
 * @param {string} caseId - Target Case Object ID
 * @param {string} noteText - Body of confidential clinical note
 * @returns {Promise<Object>} Created note entity confirmation
 */
export const addCasePrivateNote = async (caseId, noteText) => {
  if (!caseId) {
    throw new Error('[Psychologist API Validation] Case ID is mandatory for creating clinical notes');
  }
  if (!noteText || typeof noteText !== 'string' || !noteText.trim()) {
    throw new Error('[Psychologist API Validation] Private note content cannot be empty or whitespace');
  }

  try {
    const payload = {
      noteText: noteText.trim(),
      createdAt: new Date().toISOString(),
    };

    const response = await axios.post(
      `${API_BASE_URL}/psychologist/cases/${caseId}/notes`,
      payload,
      getAuthHeaders()
    );

    return {
      success: true,
      data: response.data?.data || response.data,
      message: 'Confidential clinical note recorded successfully',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[Psychologist API Service Error] addCasePrivateNote failure for Case ${caseId}:`, {
      error: error.message,
      response: error.response?.data,
    });
    const errorMessage = error.response?.data?.message || 'Failed to record confidential note';
    throw new Error(errorMessage);
  }
};

// Node/Jest Fallback Bridge
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getPsychologistSummary,
    getAssignedCases,
    getCaseDetailsById,
    updateCaseStatus,
    getCasePrivateNotes,
    addCasePrivateNote,
  };
}