import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ResourceLibrary = () => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const initialMockData = [
    {
      _id: '1',
      title: 'Coping with Anxiety Guide',
      category: 'Mental Health',
      type: 'PDF',
      description: 'Practical grounding techniques and breathing exercises for acute anxiety.',
      link: 'https://example.com/anxiety-guide.pdf'
    },
    {
      _id: '2',
      title: 'Mindfulness Meditation Audio',
      category: 'Wellness',
      type: 'Audio',
      description: '10-minute guided daily meditation for stress reduction.',
      link: 'https://example.com/meditation.mp3'
    },
    {
      _id: '3',
      title: 'Understanding Sleep Hygiene',
      category: 'Lifestyle',
      type: 'Article',
      description: 'Scientific tips to improve your sleep cycle and restful sleep.',
      link: 'https://example.com/sleep-hygiene'
    }
  ];

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      // The API answers { count, resources }, so res.data itself has no
      // .length - reading it that way always fell through to the mock data.
      // The path stays relative so the Vite proxy (and any deployment) works.
      const res = await axios.get('/api/resources');
      const fetched = res.data?.resources || [];
      setResources(fetched.length > 0 ? fetched : initialMockData);
    } catch (err) {
      console.warn("Backend API not reachable, loading default resources.");
      setResources(initialMockData);
    } finally {
      setLoading(false);
    }
  };

  const filteredResources = resources.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', 'Mental Health', 'Wellness', 'Lifestyle'];

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h2>MindEase Resource Library</h2>
        <p>Explore verified articles, audio guides, and tools for mental well-being.</p>
      </header>

      {/* Filter & Search Bar */}
      <div style={filterContainerStyle}>
        <input
          type="text"
          placeholder="Search resources..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={inputStyle}
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={selectStyle}
        >
          {categories.map((cat, idx) => (
            <option key={idx} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Resource Cards Grid */}
      {loading ? (
        <p style={{ textAlign: 'center' }}>Loading resources...</p>
      ) : (
        <div style={gridStyle}>
          {filteredResources.map((resource) => (
            <div key={resource._id} style={cardStyle}>
              <div>
                <div style={badgeStyle}>{resource.category}</div>
                <h3 style={{ marginTop: '10px' }}>{resource.title}</h3>
                <p style={{ color: '#555', fontSize: '0.9rem' }}>{resource.description}</p>
              </div>
              <div style={cardFooterStyle}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#007bff' }}>
                  [{resource.type}]
                </span>
                <a 
                  href={resource.link} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={linkBtnStyle}
                >
                  Access Resource
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Inline Styles
const containerStyle = { maxWidth: '1000px', margin: '0 auto', padding: '20px' };
const headerStyle = { textAlign: 'center', marginBottom: '30px' };
const filterContainerStyle = { display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' };
const inputStyle = { flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' };
const selectStyle = { padding: '10px', borderRadius: '6px', border: '1px solid #ccc' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' };
const cardStyle = { background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' };
const badgeStyle = { display: 'inline-block', background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' };
const cardFooterStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' };
const linkBtnStyle = { background: '#4f46e5', color: '#fff', padding: '6px 12px', borderRadius: '4px', textDecoration: 'none', fontSize: '0.85rem' };

export default ResourceLibrary;