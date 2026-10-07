import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ManageResources = () => {
  const [resources, setResources] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    category: 'Mental Health',
    type: 'PDF',
    description: '',
    link: ''
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchAdminResources();
  }, []);

  const fetchAdminResources = async () => {
    try {
      // The API answers { count, resources }, not a bare array.
      const res = await axios.get('/api/resources');
      setResources(res.data?.resources || []);
    } catch (err) {
      console.warn("Using local state for Admin Manage Resources.");
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      // Update existing item
      try {
        await axios.put(`http://localhost:5000/api/resources/${editingId}`, formData);
      } catch (e) {}
      setResources(resources.map(item => item._id === editingId ? { ...formData, _id: editingId } : item));
      setEditingId(null);
    } else {
      // Create new item
      const newItem = { ...formData, _id: Date.now().toString() };
      try {
        await axios.post('http://localhost:5000/api/resources', formData);
      } catch (e) {}
      setResources([...resources, newItem]);
    }

    setFormData({ title: '', category: 'Mental Health', type: 'PDF', description: '', link: '' });
  };

  const handleEdit = (item) => {
    setEditingId(item._id);
    setFormData(item);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this resource?')) {
      try {
        await axios.delete(`http://localhost:5000/api/resources/${id}`);
      } catch (e) {}
      setResources(resources.filter(item => item._id !== id));
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <h2>Admin Resource Management</h2>
      
      {/* Create/Edit Resource Form */}
      <form onSubmit={handleSubmit} style={formStyle}>
        <h3>{editingId ? 'Edit Resource' : 'Add New Resource'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <input
            type="text"
            name="title"
            placeholder="Title"
            value={formData.title}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <input
            type="url"
            name="link"
            placeholder="Resource Link/URL"
            value={formData.link}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <select name="category" value={formData.category} onChange={handleChange} style={inputStyle}>
            <option value="Mental Health">Mental Health</option>
            <option value="Wellness">Wellness</option>
            <option value="Lifestyle">Lifestyle</option>
          </select>
          <select name="type" value={formData.type} onChange={handleChange} style={inputStyle}>
            <option value="PDF">PDF</option>
            <option value="Audio">Audio</option>
            <option value="Article">Article</option>
            <option value="Video">Video</option>
          </select>
        </div>
        <textarea
          name="description"
          placeholder="Resource Description..."
          value={formData.description}
          onChange={handleChange}
          required
          style={{ ...inputStyle, width: '100%', height: '70px', marginBottom: '10px' }}
        />
        <button type="submit" style={btnStyle}>
          {editingId ? 'Update Resource' : 'Add Resource'}
        </button>
      </form>

      {/* Management Table */}
      <h3>Existing Resources</h3>
      <table style={tableStyle}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={thTdStyle}>Title</th>
            <th style={thTdStyle}>Category</th>
            <th style={thTdStyle}>Type</th>
            <th style={thTdStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {resources.length === 0 ? (
            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '15px' }}>No resources available.</td></tr>
          ) : (
            resources.map((item) => (
              <tr key={item._id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={thTdStyle}>{item.title}</td>
                <td style={thTdStyle}>{item.category}</td>
                <td style={thTdStyle}>{item.type}</td>
                <td style={thTdStyle}>
                  <button onClick={() => handleEdit(item)} style={{ ...actionBtnStyle, background: '#f59e0b' }}>Edit</button>
                  <button onClick={() => handleDelete(item._id)} style={{ ...actionBtnStyle, background: '#ef4444' }}>Delete</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

// Styles
const formStyle = { background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '30px' };
const inputStyle = { padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' };
const btnStyle = { background: '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', marginTop: '10px' };
const thTdStyle = { padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' };
const actionBtnStyle = { color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' };

export default ManageResources;