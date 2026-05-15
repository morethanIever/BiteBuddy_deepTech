import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const result = await login(form.email, form.password);
    if (result.ok) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="pt-16 min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="card max-w-sm w-full p-8 shadow-xl">
        <div className="text-center mb-8">
          <div className="font-head text-2xl font-extrabold text-navy mb-1">
            Bite<span className="text-green">Buddy</span>
          </div>
          <div className="text-sm text-gray-400">Admin Dashboard Login</div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Email</label>
            <input
              type="email"
              className="input-field"
              placeholder="admin@bitebuddy.app"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full mt-2 disabled:opacity-60">
            {loading ? 'Logging in…' : 'Login →'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-300">
          <Link to="/" className="text-green hover:underline no-underline">← Back to Home</Link>
        </div>

        <div className="mt-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-400 text-center">
          Demo: <code className="font-mono">admin@bitebuddy.app</code> / <code className="font-mono">bitebuddy2024</code>
        </div>
      </div>
    </div>
  );
}
