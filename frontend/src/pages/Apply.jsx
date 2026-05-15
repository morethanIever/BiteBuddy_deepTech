import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../lib/toast';

const CUISINE_TYPES = [
  'Malaysian', 'Indian Muslim', 'Chinese', 'South Indian',
  'Japanese', 'Korean', 'Thai', 'International',
  'Street Food', 'Food Court', 'Café', 'Fine Dining', 'Other',
];

export default function Apply() {
  const toast = useToast();
  const [form, setForm] = useState({
    restaurant_name: '', cuisine_type: '', area: '',
    contact_email: '', contact_phone: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      await api.post('/api/applications', form);
      setSubmitted(true);
      toast('✅ Application submitted successfully!', 'success');
    } catch (err) {
      const apiErrors = err.response?.data?.errors || [];
      const mapped = {};
      apiErrors.forEach(e => { mapped[e.path] = e.msg; });
      setErrors(mapped);
      if (!apiErrors.length) toast(err.response?.data?.error || 'Submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pt-16 min-h-screen">
      {/* Hero */}
      <div className="bg-navy py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-head text-4xl font-extrabold text-white mb-3">Get Your Restaurant Certified</h1>
          <p className="text-white/60 text-lg leading-relaxed">
            Join the BiteBuddy B2B program. We install the biosensor device at your location, provide automated testing, a certified QR code for display, and full dashboard access. Appear on our Safe Restaurant Map and attract safety-conscious diners.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Benefits */}
        <div className="grid sm:grid-cols-3 gap-4 mb-12">
          {[
            ['🔬','Device provided','We install and maintain the biosensor at your location'],
            ['📋','QR Certificate','Display a verified certificate — customers can scan to trust you'],
            ['🗺️','Map listing','Appear on the BiteBuddy Safe Map seen by thousands of travelers'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="card p-5 text-center">
              <div className="text-3xl mb-2">{icon}</div>
              <div className="font-semibold text-sm text-navy mb-1">{title}</div>
              <div className="text-xs text-gray-400 leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>

        {submitted ? (
          <div className="card p-10 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="font-head text-2xl font-bold text-navy mb-2">Application Received!</h2>
            <p className="text-gray-400 mb-6">
              We've received your application for <strong>{form.restaurant_name}</strong>.
              Our team will contact you at <strong>{form.contact_email || 'the provided contact'}</strong> within 24 hours.
            </p>
            <div className="flex gap-3 justify-center">
              <Link to="/map" className="btn-primary no-underline">View Safe Map</Link>
              <button onClick={() => { setSubmitted(false); setForm({ restaurant_name:'', cuisine_type:'', area:'', contact_email:'', contact_phone:'', notes:'' }); }}
                className="btn-outline">Submit Another</button>
            </div>
          </div>
        ) : (
          <div className="card p-8">
            <h2 className="font-head text-xl font-bold text-navy mb-6">Restaurant Application Form</h2>
            <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Restaurant Name *</label>
                <input
                  className={`input-field ${errors.restaurant_name ? 'border-red-300' : ''}`}
                  placeholder="e.g. Nasi Kandar Pelita"
                  value={form.restaurant_name}
                  onChange={e => set('restaurant_name', e.target.value)}
                  required
                />
                {errors.restaurant_name && <div className="text-xs text-red-500 mt-1">{errors.restaurant_name}</div>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Cuisine Type</label>
                <select className="input-field" value={form.cuisine_type} onChange={e => set('cuisine_type', e.target.value)}>
                  <option value="">Select type…</option>
                  {CUISINE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Area / Location *</label>
                <input
                  className={`input-field ${errors.area ? 'border-red-300' : ''}`}
                  placeholder="e.g. KLCC, Bukit Bintang, Bangsar"
                  value={form.area}
                  onChange={e => set('area', e.target.value)}
                  required
                />
                {errors.area && <div className="text-xs text-red-500 mt-1">{errors.area}</div>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Contact Email</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="owner@restaurant.com"
                  value={form.contact_email}
                  onChange={e => set('contact_email', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Contact Phone</label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="+60 12-345 6789"
                  value={form.contact_phone}
                  onChange={e => set('contact_phone', e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Additional Notes</label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Tell us about your restaurant, daily covers, certifications you already hold, questions…"
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <button type="submit" disabled={submitting} className="btn-primary w-full py-4 text-base disabled:opacity-60">
                  {submitting ? 'Submitting…' : 'Submit Application →'}
                </button>
                <p className="text-xs text-gray-300 text-center mt-3">
                  We typically respond within 24 hours. No commitment required.
                </p>
              </div>
            </form>
          </div>
        )}
      </div>

      <footer className="bg-navy text-white/50 text-center py-8 text-sm">
        <strong className="text-white">BiteBuddy</strong> — Eat Safe. Anywhere. · © 2026 BiteBuddy Sdn Bhd
      </footer>
    </div>
  );
}
