import React, { useState } from 'react';
import MessageBubble from './MessageBubble';

export default function ChatWindow({ currentUserId }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      senderId: 'support',
      text: 'Hello! Welcome to MindEase Support. How can we assist you today?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMessage = {
      id: Date.now(),
      senderId: currentUserId,
      text: inputMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputMessage('');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '520px',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: '#f7faf8',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#38a169',
              boxShadow: '0 0 0 3px rgba(56, 161, 105, 0.2)',
            }}
          />
          <div>
            <h4 style={{ margin: 0, color: '#2d3748', fontSize: '16px', fontWeight: '600' }}>
              MindEase Support
            </h4>
            <span style={{ fontSize: '12px', color: '#718096' }}>Online | Instant Response</span>
          </div>
        </div>
      </div>

      {/* Message List Area */}
      <div
        style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          backgroundColor: '#f7faf8',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwnMessage={msg.senderId === currentUserId}
          />
        ))}
      </div>

      {/* Styled Input Bar */}
      <form
        onSubmit={handleSend}
        style={{
          padding: '16px 20px',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message here..."
          style={{
            flex: 1,
            padding: '12px 18px',
            borderRadius: '24px',
            border: '1px solid #cbd5e0',
            backgroundColor: '#f7faf8',
            fontSize: '14px',
            color: '#2d3748',
            outline: 'none',
            transition: 'all 0.2s ease',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#2f855a';
            e.target.style.backgroundColor = '#ffffff';
            e.target.style.boxShadow = '0 0 0 3px rgba(47, 133, 90, 0.15)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#cbd5e0';
            e.target.style.backgroundColor = '#f7faf8';
            e.target.style.boxShadow = 'none';
          }}
        />

        <button
          type="submit"
          disabled={!inputMessage.trim()}
          style={{
            backgroundColor: inputMessage.trim() ? '#2f855a' : '#a0aec0',
            color: '#ffffff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '24px',
            fontWeight: '600',
            fontSize: '14px',
            cursor: inputMessage.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            boxShadow: inputMessage.trim() ? '0 4px 12px rgba(47, 133, 90, 0.25)' : 'none',
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}