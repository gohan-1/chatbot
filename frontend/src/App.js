/**
 * Main App Component
 * 
 * This is the main component that contains the entire chat interface.
 * It manages:
 * - The list of messages (user and AI)
 * - Sending messages to the backend
 * - Displaying the chat UI
 */

import React, { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  // State to store all messages (both user and AI)
  // Each message has: { text: "message text", sender: "user" or "ai" }
  const [messages, setMessages] = useState([
    {
      text: "Hello! I'm your Samsung warranty specialist. I can help you with information about Samsung product warranties, repairs, product registration, and support services. How can I assist you today?",
      sender: "ai"
    }
  ]);

  // Quick action suggestions
  const quickActions = [
    "What is tablet warranty period?",
    "How long is smartphone warranty?",
    "Cooker hood warranty period",
    "How to register my product?"
  ];

  // State to store the current input text (what user is typing)
  const [inputText, setInputText] = useState('');

  // State to track if we're waiting for AI response (for loading indicator)
  const [isLoading, setIsLoading] = useState(false);

  // Ref to automatically scroll to bottom when new messages arrive
  const messagesEndRef = useRef(null);

  // Function to scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * Function to send a message to the backend API
   * 
   * Steps:
   * 1. Add user's message to the chat
   * 2. Send message to backend
   * 3. Get AI response
   * 4. Add AI response to the chat
   */
  const sendMessage = async () => {
    // Don't send empty messages
    if (!inputText.trim()) return;

    // Get the user's message
    const userMessage = inputText.trim();

    // Clear the input field
    setInputText('');

    // Add user's message to the chat immediately
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);

    // Set loading state (shows "AI is typing..." indicator)
    setIsLoading(true);

    try {
      // Send message to backend API
      // The backend is running on http://localhost:3001
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // Tell server we're sending JSON
        },
        body: JSON.stringify({ message: userMessage }), // Send the message
      });

      // Check if request was successful
      if (!response.ok) {
        throw new Error('Failed to get response from server');
      }

      // Get the AI's response from the server
      const data = await response.json();

      // Add AI's response to the chat
      setMessages(prev => [...prev, { text: data.response, sender: 'ai' }]);

    } catch (error) {
      // If something goes wrong, show error message
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        text: 'Sorry, I encountered an error. Please try again.',
        sender: 'ai'
      }]);
    } finally {
      // Always turn off loading indicator
      setIsLoading(false);
    }
  };

  /**
   * Handle form submission (when user presses Enter)
   */
  const handleSubmit = (e) => {
    e.preventDefault(); // Prevent page refresh
    sendMessage();
  };

  return (
    <div className="App">
      {/* Header */}
      <header className="chat-header">
        <h1>Samsung Warranty Assistant</h1>
      </header>

      {/* Messages container */}
      <div className="messages-container">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${message.sender === 'user' ? 'user-message' : 'ai-message'}`}
          >
            <div className="message-content">
              {message.text}
            </div>
          </div>
        ))}

        {/* Quick action buttons (show only when no user messages yet or after welcome) */}
        {messages.length === 1 && (
          <div className="quick-actions">
            <p className="quick-actions-label">Quick questions:</p>
            <div className="quick-actions-buttons">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  className="quick-action-btn"
                  onClick={() => {
                    setInputText(action);
                    setTimeout(() => {
                      const form = document.querySelector('.input-form');
                      if (form) {
                        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                      }
                    }, 100);
                  }}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading indicator when AI is responding */}
        {isLoading && (
          <div className="message ai-message">
            <div className="message-content loading">
              AI is typing...
            </div>
          </div>
        )}

        {/* Invisible element to scroll to */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <form className="input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type your message here..."
          className="message-input"
          disabled={isLoading} // Disable input while waiting for response
        />
        <button
          type="submit"
          className="send-button"
          disabled={isLoading || !inputText.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default App;

