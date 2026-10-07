import React, { useState, useEffect } from 'react';
import ResourceCard from '../../components/ResourceCard';

const ManageResources = () => {
  const [resources, setResources] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    category: 'mental_health',
    description: '',
    link: '',
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    const res = await fetch('/api/resources');
    const data = await res.json();
    // See ResourceLibrary: the API has no `success` key, only { count, resources }.
    if (res.ok) setResources(data.resources || data.data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingId ? `/api/resources/${editingId}` : '/api/resources';
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (res.ok) {
      setFormData({ title: '', category: 'mental_health', description: '', link: '' });
      setEditingId(null);
      fetchResources();
    }
  };

  const handleEdit = (resource) => {
    setEditingId(resource._id);
    setFormData({
      title: resource.title,
      category: resource.category,
      description: resource.description,
      link: resource.link || '',
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this resource?')) return;
    const res = await fetch(`/api/resources/${id}`, { method: 'DELETE' });
    if (res.ok) fetchResources();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Manage Resources (Admin)</h1>

      {/* Resource Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md mb-10 border border-gray-100">
        <h2 className="text-xl font-semibold mb-4">{editingId ? 'Edit Resource' : 'Add New Resource'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            placeholder="Resource Title"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="p-2 border rounded"
          />
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="p-2 border rounded"
          >
            <option value="mental_health">Mental Health</option>
            <option value="abuse_violence">Abuse & Violence</option>
            <option value="legal_aid">Legal Aid</option>
            <option value="medical">Medical</option>
            <option value="other">Other</option>
          </select>
        </div>
        <textarea
          placeholder="Description"
          required
          rows="3"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full p-2 border rounded mb-4"
        />
        <input
          type="url"
          placeholder="External Link (https://...)"
          value={formData.link}
          onChange={(e) => setFormData({ ...formData, link: e.target.value })}
          className="w-full p-2 border rounded mb-4"
        />
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            {editingId ? 'Update Resource' : 'Create Resource'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setFormData({ title: '', category: 'mental_health', description: '', link: '' });
              }}
              className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Existing Resources List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {resources.map((res) => (
          <ResourceCard key={res._id} resource={res} isAdmin={true} onEdit={handleEdit} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
};

export default ManageResources;