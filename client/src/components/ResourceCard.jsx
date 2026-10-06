import React from 'react';

const ResourceCard = ({ resource, isAdmin, onEdit, onDelete }) => {
  const { title, category, description, link, tags } = resource;

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full capitalize">
            {category}
          </span>
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">{description}</p>

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {tags.map((tag, idx) => (
              <span key={idx} className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
          >
            Read / Access Resource &rarr;
          </a>
        )}

        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(resource)}
              className="px-3 py-1 bg-amber-500 text-white text-xs rounded hover:bg-amber-600"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(resource._id)}
              className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourceCard;