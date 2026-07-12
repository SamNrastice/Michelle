import React, { useState } from 'react';
import ChatContainer from './components/ChatContainer';
import BookingForm from './components/BookingForm';
import BookingsList from './components/BookingsList';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [bookings, setBookings] = useState([]);

  const handleBookingCreated = (booking) => {
    setBookings((prev) => [booking, ...prev]);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🤖</span>
            <span className="logo-text">Michelle</span>
          </div>
          <p className="tagline">AI Booking Assistant</p>
        </div>
        <nav className="app-nav">
          <button
            className={`nav-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            💬 Chat
          </button>
          <button
            className={`nav-btn ${activeTab === 'book' ? 'active' : ''}`}
            onClick={() => setActiveTab('book')}
          >
            📅 New Booking
          </button>
          <button
            className={`nav-btn ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            📋 All Bookings
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'chat' && (
          <ChatContainer onBookingCreated={handleBookingCreated} />
        )}
        {activeTab === 'book' && (
          <BookingForm
            onBookingCreated={(booking) => {
              handleBookingCreated(booking);
              setActiveTab('bookings');
            }}
          />
        )}
        {activeTab === 'bookings' && (
          <BookingsList bookings={bookings} onRefresh={setBookings} />
        )}
      </main>
    </div>
  );
}

export default App;
