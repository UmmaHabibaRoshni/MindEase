import React, { useState } from 'react';

export default function ChatInput({ onSendMessage }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text);
    setText('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        borderTop: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
      }}
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        style={{
          flex: 1,
          padding: '10px 14px',
          borderRadius: '20px',
          border: '1px solid #cbd5e0',
          outline: 'none',
          fontSize: '14px',
          backgroundColor: '#f7fafc',
        }}
      />
      <button
        type="submit"
        style={{
          backgroundColor: '#3182ce',
          color: '#ffffff',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '20px',
          fontWeight: '600',
          fontSize: '14px',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
      >
        Send
      </button>
    </form>
  );
}