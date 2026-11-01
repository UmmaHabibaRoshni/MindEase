import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getCaseDetailsById,
  updateCaseStatus,
  getCasePrivateNotes,
  addCasePrivateNote,
} from '../../api/psychologistApi';
import JoinVideoButton from '../../components/video/JoinVideoButton';

// T18.8 - the API answers { case: {...} } with lowercase statuses, while the
// rest of this page was written against a flat object with capitalised ones.
// Normalising here keeps the video button correct either way, without
// rewriting the page around it.
const unwrapCase = (data) => data?.case || data || null;
const caseStatusOf = (data) => String(unwrapCase(data)?.status || '').toLowerCase();
const caseIdOf = (data) => unwrapCase(data)?._id || null;

const CaseDetailPage = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();

  // Core Entity States
  const [caseData, setCaseData] = useState(null);
  const [notes, setNotes] = useState([]);
  
  // Interactive UI Form States
  const [newNote, setNewNote] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [targetActionStatus, setTargetActionStatus] = useState(null);

  // Status & Asynchronous Flags
  const [loading, setLoading] = useState(true);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState(null);
  const [noteFilterQuery, setNoteFilterQuery] = useState('');

  // Primary Fetcher for Case Record and Private Encrypted Notes
  const fetchCaseDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [caseRes, notesRes] = await Promise.all([
        getCaseDetailsById(caseId),
        getCasePrivateNotes(caseId),
      ]);

      if (caseRes && caseRes.success) {
        setCaseData(caseRes.data);
      }

      if (notesRes && notesRes.success) {
        setNotes(Array.isArray(notesRes.data) ? notesRes.data : []);
      }
    } catch (err) {
      console.error(`CaseDetailPage error fetching data for #${caseId}:`, err);
      setError(err.message || 'Failed to retrieve detailed case record from server');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchCaseDetails();
  }, [fetchCaseDetails]);

  // Status Transition Handler
  const initiateStatusChange = (status) => {
    setTargetActionStatus(status);
    setDecisionReason('');
    setShowDecisionModal(true);
  };

  const confirmStatusChange = async () => {
    if (!targetActionStatus) return;

    try {
      setUpdatingStatus(true);
      await updateCaseStatus(caseId, targetActionStatus, decisionReason);
      setShowDecisionModal(false);
      setDecisionReason('');
      await fetchCaseDetails();
    } catch (err) {
      console.error('Error updating case lifecycle status:', err);
      alert(err.message || 'Error executing status transition');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Submit Encrypted Private Clinical Observation Note
  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      setSubmittingNote(true);
      await addCasePrivateNote(caseId, newNote);
      setNewNote('');
      const updatedNotesRes = await getCasePrivateNotes(caseId);
      if (updatedNotesRes && updatedNotesRes.success) {
        setNotes(Array.isArray(updatedNotesRes.data) ? updatedNotesRes.data : []);
      }
    } catch (err) {
      console.error('Error creating private note:', err);
      alert(err.message || 'Error recording private clinical observation');
    } finally {
      setSubmittingNote(false);
    }
  };

  // Filter notes based on search query
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const text = n.noteText?.toLowerCase() || '';
      return text.includes(noteFilterQuery.toLowerCase().trim());
    });
  }, [notes, noteFilterQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="text-center space-y-4">
          <div className="w-11 h-11 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div>
            <p className="text-sm font-bold text-slate-700">Accessing Encrypted Clinical Dossier...</p>
            <p className="text-xs text-slate-400 mt-0.5">Reference ID: #{caseId}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="bg-white p-8 rounded-2xl border border-rose-200 text-center max-w-md w-full shadow-sm space-y-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center mx-auto text-xl font-black">!</div>
          <h3 className="text-lg font-bold text-slate-800">Unable to Open Case File</h3>
          <p className="text-xs text-rose-600 leading-relaxed">{error}</p>
          <button
            onClick={() => navigate('/psychologist/dashboard')}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Return to Case Directory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-4 sm:p-6 lg:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Navigation Breadcrumb Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/psychologist/dashboard')}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-900 flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200 transition-colors cursor-pointer"
          >
            ← Back to Case Directory
          </button>
          <span className="text-xs text-slate-400 font-mono bg-white px-3 py-1 rounded-lg border border-slate-200">
            Case Ref: {caseData?._id}
          </span>
        </div>

        {/* Case Header & Primary Action Controls */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Clinical Case File</span>
              <h1 className="text-2xl font-black text-slate-800 mt-1">
                Client: {caseData?.seeker?.name || 'Anonymous Seeker'}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Assigned Session | Lifecycle Status:{' '}
                <strong className="text-emerald-700 uppercase font-black">{caseData?.status}</strong>
              </p>
            </div>

            {/* Lifecycle Action Triggers */}
            <div className="flex items-center gap-3">
              {caseData?.status === 'Pending' && (
                <>
                  <button
                    onClick={() => initiateStatusChange('Accepted')}
                    className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    Accept Case Request
                  </button>
                  <button
                    onClick={() => initiateStatusChange('Rejected')}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    Reject Case
                  </button>
                </>
              )}

              {caseData?.status === 'Accepted' && (
                <button
                  onClick={() => initiateStatusChange('Completed')}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Mark Session Completed
                </button>
              )}

              {/* T18.8 - the consultation room. Only on an accepted case:
                  the API refuses any other status, so showing it earlier
                  would only produce an error the psychologist cannot act on. */}
              {caseStatusOf(caseData) === 'accepted' && caseIdOf(caseData) && (
                <JoinVideoButton
                  kind="case"
                  id={caseIdOf(caseData)}
                  label="Join video consultation"
                  startLabel="Start video consultation"
                />
              )}
            </div>
          </div>

          {/* Context Overview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-2.5">
              <h4 className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">Seeker Context Demographics</h4>
              <p className="text-sm font-bold text-slate-800">{caseData?.seeker?.name || 'Anonymous'}</p>
              <p className="text-slate-600">Email Contact: <strong className="text-slate-800">{caseData?.seeker?.email || 'N/A'}</strong></p>
              <p className="text-slate-600">Preferred Language: <strong className="text-slate-800">{caseData?.seeker?.language || 'English'}</strong></p>
              <p className="text-slate-600">First Contacted: <strong className="text-slate-800">{new Date(caseData?.createdAt || Date.now()).toLocaleDateString()}</strong></p>
            </div>

            <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-2.5">
              <h4 className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">Volunteer Handover Summary</h4>
              <p className="text-slate-700 italic leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                "{caseData?.handoverSummary || 'No preliminary volunteer handover notes recorded for this case.'}"
              </p>
              <p className="text-slate-400 text-[11px] pt-1">
                Handover Volunteer: <strong className="text-slate-600">{caseData?.volunteer?.name || 'System Auto-Assign'}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Private Clinical Notes Component */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Encrypted Private Clinical Notes</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Confidential psychologist notes. Visible strictly to you for clinical observations and session diagnosis.
              </p>
            </div>

            {/* Note search query */}
            <input
              type="text"
              value={noteFilterQuery}
              onChange={(e) => setNoteFilterQuery(e.target.value)}
              placeholder="Filter notes..."
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[160px]"
            />
          </div>

          {/* Add Note Form */}
          <form onSubmit={handleNoteSubmit} className="space-y-3">
            <textarea
              rows="4"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Record clinical observation, risk evaluation, progress notes, or session treatment recommendations..."
              className="w-full p-4 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submittingNote || !newNote.trim()}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                {submittingNote ? 'Encrypting & Saving Note...' : 'Record Private Note'}
              </button>
            </div>
          </form>

          {/* Historical Notes Feed */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Recorded Clinical Notes ({filteredNotes.length})
            </h4>

            {filteredNotes.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">No confidential clinical notes matching criteria.</p>
            ) : (
              filteredNotes.map((noteItem) => (
                <div key={noteItem._id || Math.random()} className="p-4 bg-slate-50/90 border border-slate-200/90 rounded-2xl space-y-2">
                  <p className="text-xs text-slate-800 leading-relaxed font-medium">{noteItem.noteText}</p>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 font-mono">
                    <span>Logged by: {noteItem.psychologist?.name || 'Psychologist'}</span>
                    <span>{new Date(noteItem.createdAt || Date.now()).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Status Decision Confirmation Modal Dialogue */}
        {showDecisionModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200">
              <h3 className="text-lg font-black text-slate-800">
                Confirm Status Transition: <span className="text-emerald-700">{targetActionStatus}</span>
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to transition this case status to <strong>{targetActionStatus}</strong>?
              </p>

              <textarea
                rows="3"
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="Optional justification or clinical decision rationale..."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowDecisionModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStatusChange}
                  disabled={updatingStatus}
                  className="px-5 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                >
                  {updatingStatus ? 'Updating...' : 'Confirm Decision'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CaseDetailPage;