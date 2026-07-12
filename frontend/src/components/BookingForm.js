import React, { useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function BookingForm({ onBookingCreated }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    date: '',
    time: '',
    service: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.date || !form.time) {
      setAlert({ type: 'error', message: 'Please fill in Name, Date and Time.' });
      return;
    }

    setLoading(true);
    setAlert(null);

    try {
      const res = await fetch(`${API_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (data.success) {
        setAlert({ type: 'success', message: `✅ Booking confirmed! ID: ${data.booking.id}` });
        setForm({ name: '', email: '', date: '', time: '', service: '', notes: '' });
        if (onBookingCreated) onBookingCreated(data.booking);
      } else {
        setAlert({ type: 'error', message: data.error || 'Booking failed.' });
      }
    } catch (err) {
      setAlert({ type: 'error', message: 'Network error — please check that the backend is running.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="booking-form">
      <h2>📅 New Booking</h2>

      {alert && (
        <div className={`alert alert-${alert.type}`}>{alert.message}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Your full name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="date">Date *</label>
            <input
              id="date"
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="time">Time *</label>
            <input
              id="time"
              name="time"
              type="time"
              value={form.time}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="service">Service</label>
          <input
            id="service"
            name="service"
            type="text"
            placeholder="e.g. Consultation, Hair Cut, Dental Check-up…"
            value={form.service}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            name="notes"
            placeholder="Any additional notes…"
            value={form.notes}
            onChange={handleChange}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '⏳ Confirming…' : '✅ Confirm Booking'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setForm({ name: '', email: '', date: '', time: '', service: '', notes: '' })}
            disabled={loading}
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}

export default BookingForm;
