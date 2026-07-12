import React, { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function BookingsList({ bookings: initialBookings, onRefresh }) {
  const [bookings, setBookings] = useState(initialBookings || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setBookings(initialBookings || []);
  }, [initialBookings]);

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/bookings`);
      const data = await res.json();
      if (data.success) {
        setBookings(data.bookings);
        if (onRefresh) onRefresh(data.bookings);
      } else {
        setError(data.error || 'Failed to load bookings.');
      }
    } catch (err) {
      setError('Network error — please check that the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // Load bookings on mount
  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bookings-list">
      <div className="bookings-controls">
        <h2>📋 All Bookings ({bookings.length})</h2>
        <button className="btn btn-secondary" onClick={fetchBookings} disabled={loading}>
          {loading ? '⏳ Loading…' : '🔄 Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {bookings.length === 0 ? (
        <div className="empty-state">
          <p>📭</p>
          <p>No bookings yet.</p>
          <p style={{ fontSize: '13px', marginTop: '8px' }}>
            Use the Chat or New Booking tab to create one!
          </p>
        </div>
      ) : (
        <div className="bookings-grid">
          {bookings.map((booking) => (
            <div key={booking.id} className="booking-card">
              <div className="booking-card-header">
                <span className="booking-id">{booking.id}</span>
                <span className="badge badge-confirmed">{booking.status || 'confirmed'}</span>
              </div>
              <div className="booking-name">{booking.name}</div>
              <div className="booking-service">
                {booking.service || 'General Appointment'}
              </div>
              <div className="booking-details">
                <div className="booking-detail">
                  <span className="label">Date</span>
                  <span className="value">📅 {booking.date}</span>
                </div>
                <div className="booking-detail">
                  <span className="label">Time</span>
                  <span className="value">🕐 {booking.time}</span>
                </div>
                {booking.email && (
                  <div className="booking-detail">
                    <span className="label">Email</span>
                    <span className="value">✉️ {booking.email}</span>
                  </div>
                )}
                {booking.notes && (
                  <div className="booking-detail">
                    <span className="label">Notes</span>
                    <span className="value">{booking.notes}</span>
                  </div>
                )}
                <div className="booking-detail">
                  <span className="label">Created</span>
                  <span className="value">
                    {new Date(booking.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BookingsList;
