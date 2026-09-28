import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function SeekerDashboard() {
  // Demo Data (Real app-e backend API theke ashbe)
  const [requests] = useState([
    {
      id: 'REQ-101',
      category: 'Anxiety',
      urgency: 'Moderate',
      status: 'In Progress',
      date: '2026-09-22',
      notes: 'Experiencing severe anxiety attacks during evening hours.'
    },
    {
      id: 'REQ-089',
      category: 'Stress',
      urgency: 'Low',
      status: 'Resolved',
      date: '2026-09-15',
      notes: 'Need peer guidance regarding academic workload.'
    }
  ]);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h2>Seeker Dashboard</h2>
          <p className="text-muted">Manage and track your mental health support requests.</p>
        </div>
        <Link to="/seeker/new-request">
          <button className="btn">+ New Request</button>
        </Link>
      </div>

      <div className="card">
        <h3>Your Active Requests</h3>
        
        {requests.length === 0 ? (
          <p className="text-muted" style={{ marginTop: '1rem' }}>No active requests found.</p>
        ) : (
          <div className="request-list">
            {requests.map((req) => (
              <div key={req.id} className="request-card">
                <div className="request-header">
                  <div>
                    <span className="request-id">{req.id}</span>
                    <span className={`badge category-badge`}>{req.category}</span>
                  </div>
                  <span className={`badge status-badge ${req.status.toLowerCase().replace(' ', '-')}`}>
                    {req.status}
                  </span>
                </div>

                <p className="request-notes">{req.notes}</p>

                <div className="request-footer">
                  <small>Submitted on: {req.date}</small>
                  <small>Urgency: <strong>{req.urgency}</strong></small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}