import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPsychologistSummary, getAssignedCases } from '../../api/psychologistApi';
import DashboardPlaceholder from '../../components/common/DashboardPlaceholder';

const PsychologistDashboard = () => {
  const navigate = useNavigate();

  // Retrieve user account approval status from local context/storage
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (e) {
      console.error('Failed to parse stored user profile:', e);
      return {};
    }
  }, []);

  const isApproved = storedUser.isApproved ?? true; // Default fallback to true for active clinical access

  // Core Data & State Declarations
  const [summary, setSummary] = useState({ pending: 0, accepted: 0, completed: 0 });
  const [cases, setCases] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Dynamic Loading & Error States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCaseModal, setSelectedCaseModal] = useState(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Primary Fetch Function with Abort & Refresh Logic
  const loadDashboardData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [summaryRes, casesRes] = await Promise.all([
        getPsychologistSummary(),
        getAssignedCases(statusFilter, 1, 50, sortBy, sortOrder),
      ]);

      if (summaryRes && summaryRes.success) {
        setSummary(summaryRes.data || { pending: 0, accepted: 0, completed: 0 });
      }

      if (casesRes && casesRes.success) {
        setCases(Array.isArray(casesRes.data) ? casesRes.data : []);
      }
    } catch (err) {
      console.error('Psychologist Dashboard loading exception:', err);
      setError(err.message || 'An unexpected network error occurred while updating workspace records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    if (isApproved) {
      loadDashboardData();
    }
  }, [isApproved, loadDashboardData]);

  // Account Unapproved Fallback Render
  if (!isApproved) {
    return (
      <DashboardPlaceholder
        role="Psychologist"
        greeting="Your sessions and clients, in one place."
        note="Your account must be approved by an admin before seekers can book sessions with you."
        plannedFeatures={[
          'View upcoming clinical sessions',
          'Manage appointment availability slots',
          'Review escalated cases handed over by volunteers',
          'Maintain private encrypted session records',
        ]}
      />
    );
  }

  // Client-side Search and Filter Transformation
  const processedCases = useMemo(() => {
    return cases
      .filter((c) => {
        const seekerName = c.seeker?.name?.toLowerCase() || '';
        const caseId = c._id?.toLowerCase() || '';
        const volunteerName = c.volunteer?.name?.toLowerCase() || '';
        const query = searchQuery.toLowerCase().trim();

        if (!query) return true;
        return seekerName.includes(query) || caseId.includes(query) || volunteerName.includes(query);
      })
      .sort((a, b) => {
        const factor = sortOrder === 'asc' ? 1 : -1;
        if (sortBy === 'seekerName') {
          return (a.seeker?.name || '').localeCompare(b.seeker?.name || '') * factor;
        }
        if (sortBy === 'status') {
          return (a.status || '').localeCompare(b.status || '') * factor;
        }
        return (new Date(b.createdAt || Date.now()) - new Date(a.createdAt || Date.now())) * factor;
      });
  }, [cases, searchQuery, sortBy, sortOrder]);

  // Paginated View Slice
  const paginatedCases = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedCases.slice(startIndex, startIndex + itemsPerPage);
  }, [processedCases, currentPage]);

  const totalPages = Math.ceil(processedCases.length / itemsPerPage) || 1;

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-amber-100 text-amber-800 border-amber-300 shadow-sm';
      case 'accepted':
        return 'bg-blue-100 text-blue-800 border-blue-300 shadow-sm';
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm';
      case 'rejected':
        return 'bg-rose-100 text-rose-800 border-rose-300 shadow-sm';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300 shadow-sm';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-4 sm:p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Workspace Top Bar Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/80">
          <div>
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs tracking-wide uppercase">
                Clinical Workspace
              </span>
              <span className="text-xs text-slate-400 font-medium">| MindEase Mental Health Tele-Care</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight mt-2">
              Psychologist Consultations & Cases
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Review escalated cases, accept or reject incoming seeker requests, track active session progress, and log confidential clinical notes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadDashboardData(true)}
              disabled={refreshing || loading}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <svg
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? 'Refreshing...' : 'Sync Live Records'}
            </button>
          </div>
        </div>

        {/* Analytics Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pending Evaluation</span>
              <span className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></span>
            </div>
            <div className="text-4xl font-black text-amber-950 mt-3">{summary.pending || 0}</div>
            <p className="text-xs text-amber-700 mt-1 font-medium">Awaiting acceptance/rejection decision</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100/60 border border-blue-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Active Sessions</span>
              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
            </div>
            <div className="text-4xl font-black text-blue-950 mt-3">{summary.accepted || 0}</div>
            <p className="text-xs text-blue-700 mt-1 font-medium">In-progress active consultations</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/60 border border-emerald-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Closed & Completed</span>
              <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
            </div>
            <div className="text-4xl font-black text-emerald-950 mt-3">{summary.completed || 0}</div>
            <p className="text-xs text-emerald-700 mt-1 font-medium">Successfully completed therapy cases</p>
          </div>
        </div>

        {/* Case Directory Table & Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-extrabold text-slate-800">Assigned Clinical Directory</h2>
              <p className="text-xs text-slate-400 mt-0.5">Filter, search, and navigate through assigned seeker records.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative min-w-[220px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search seeker name or ID..."
                  className="w-full px-4 py-2 pl-9 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Filter By Status */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>

              {/* Sort Ordering */}
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="seekerName-asc">Seeker (A-Z)</option>
                <option value="status-asc">Status Order</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center justify-between">
              <span className="font-medium">{error}</span>
              <button onClick={() => loadDashboardData()} className="underline font-bold hover:text-rose-900 cursor-pointer">
                Retry Connection
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-20 text-slate-400 font-medium space-y-3">
              <div className="w-9 h-9 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-semibold text-slate-500">Retrieving assigned clinical dossiers...</p>
            </div>
          ) : paginatedCases.length === 0 ? (
            <div className="text-center py-20 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 space-y-3">
              <p className="text-sm text-slate-600 font-bold">No assigned cases matching the specified criteria.</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">Try clearing your search query or changing the workflow status filter above.</p>
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="mt-2 text-xs text-emerald-700 font-bold underline hover:text-emerald-800 cursor-pointer"
              >
                Reset All Search Filters
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Case Reference ID</th>
                      <th className="py-3.5 px-4">Seeker Name</th>
                      <th className="py-3.5 px-4">Referral Volunteer</th>
                      <th className="py-3.5 px-4">Current Status</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {paginatedCases.map((caseItem) => (
                      <tr key={caseItem._id} className="hover:bg-slate-50/90 transition-colors group">
                        <td className="py-4 px-4 font-mono text-slate-500 text-[11px] font-semibold">{caseItem._id}</td>
                        <td className="py-4 px-4 font-bold text-slate-800">
                          {caseItem.seeker?.name || 'Anonymous Seeker'}
                          {caseItem.seeker?.email && (
                            <span className="block text-[10px] text-slate-400 font-normal">{caseItem.seeker.email}</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-slate-600 font-medium">
                          {caseItem.volunteer?.name || 'System Auto-Assigned'}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${getStatusBadgeStyle(caseItem.status)}`}>
                            {caseItem.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right space-x-2">
                          <button
                            onClick={() => setSelectedCaseModal(caseItem)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all"
                          >
                            Quick View
                          </button>
                          <button
                            onClick={() => navigate(`/psychologist/case/${caseItem._id}`)}
                            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-all shadow-sm cursor-pointer"
                          >
                            Manage Case
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                <span>
                  Showing <strong>{((currentPage - 1) * itemsPerPage) + 1}</strong> to{' '}
                  <strong>{Math.min(currentPage * itemsPerPage, processedCases.length)}</strong> of{' '}
                  <strong>{processedCases.length}</strong> total cases
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 font-semibold"
                  >
                    Previous
                  </button>
                  <span className="px-2 font-bold text-slate-700">Page {currentPage} of {totalPages}</span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 font-semibold"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Quick View Drawer / Modal */}
        {selectedCaseModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-800">Case Quick Summary</h3>
                <button
                  onClick={() => setSelectedCaseModal(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <p><strong>Case ID:</strong> <span className="font-mono">{selectedCaseModal._id}</span></p>
                <p><strong>Seeker Name:</strong> {selectedCaseModal.seeker?.name || 'Anonymous'}</p>
                <p><strong>Status:</strong> {selectedCaseModal.status}</p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold block text-slate-700 mb-1">Handover Note:</span>
                  <p className="italic text-slate-500">{selectedCaseModal.handoverSummary || 'No volunteer note provided.'}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setSelectedCaseModal(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-semibold rounded-xl"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const id = selectedCaseModal._id;
                    setSelectedCaseModal(null);
                    navigate(`/psychologist/case/${id}`);
                  }}
                  className="px-4 py-2 bg-emerald-700 text-white font-semibold rounded-xl hover:bg-emerald-800"
                >
                  Open Full File
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default PsychologistDashboard;