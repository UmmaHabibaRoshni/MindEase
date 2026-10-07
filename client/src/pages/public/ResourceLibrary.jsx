import React, { useState, useEffect } from 'react';
import ResourceCard from '../../components/ResourceCard';

const ResourceLibrary = () => {
  const [resources, setResources] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  const categories = ['all', 'mental_health', 'abuse_violence', 'legal_aid', 'medical', 'other'];

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      const res = await fetch('/api/resources');
      const data = await res.json();
      // The API responds { count, resources } with no `success` key, so gating
      // on data.success left the library permanently empty.
      if (res.ok) {
        setResources(data.resources || data.data || []);
      }
    } catch (err) {
      console.error('Error fetching resources:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredResources = resources.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Resource Library</h1>
        <p className="text-gray-600">Explore helpline numbers, articles, and crisis support materials.</p>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <input
          type="text"
          placeholder="Search resources by keyword..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Resource Cards Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading resources...</div>
      ) : filteredResources.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.map((res) => (
            <ResourceCard key={res._id} resource={res} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">No resources found matching your search.</div>
      )}
    </div>
  );
};

export default ResourceLibrary;