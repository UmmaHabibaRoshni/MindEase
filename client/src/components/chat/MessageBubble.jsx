import React from 'react';

export default function MessageBubble({ message, isOwnMessage }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
        marginBottom: '12px',
      }}
    >
      <div
        style={{
          maxWidth: '70%',
          padding: '10px 14px',
          borderRadius: isOwnMessage ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
          backgroundColor: isOwnMessage ? '#3182ce' : '#edf2f7',
          color: isOwnMessage ? '#ffffff' : '#2d3748',
          fontSize: '14px',
          lineHeight: '1.4',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          wordBreak: 'break-word',
        }}
      >
        {message.text}
      </div>
      <span
        style={{
          fontSize: '11px',
          color: '#a0aec0',
          marginTop: '4px',
          paddingLeft: '4px',
          paddingRight: '4px',
        }}
      >
        {message.time || '12:00 PM'}
      </span>
    </div>
  );
}