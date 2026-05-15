import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import icon from '../icon/ICON.png';

export default function Nav() {
  const { pathname } = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const publicLinks  = [
    { to: '/',        label: 'Home' },
    { to: '/map',     label: '🗺 Safe Map' },
    { to: '/pricing', label: 'Pricing' },
    { to: '/apply',   label: 'Get Certified' },
    { to: '/portal',  label: '🍽 Restaurant' },
  ];
  const adminLinks = [
    { to: '/simulator',    label: '🔬 Device Sim',  badge: null },
    { to: '/dashboard',    label: 'Dashboard',       badge: 'Admin' },
    { to: '/applications', label: '📋 Applications', badge: null },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
        {/* Logo — fixed left */}
        <Link to="/" className="flex items-center gap-2 no-underline flex-shrink-0">
          <img src={icon} alt="BiteBuddy" className="h-9 w-9 object-contain" />
          <span className="font-head text-2xl font-extrabold text-navy">Bite<span className="text-green">Buddy</span></span>
        </Link>

        {/* Links — centred */}
        <div className="hidden md:flex flex-1 justify-center items-center gap-1">
          {publicLinks.map(l => (
            <Link key={l.to} to={l.to}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition no-underline text-center${
                pathname === l.to ? 'bg-green-light text-green-dark' : 'text-gray-500 hover:text-navy hover:bg-gray-100'
              }`}
            >{l.label}</Link>
          ))}

          {isAuthenticated && adminLinks.map(l => (
            <Link key={l.to} to={l.to}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition no-underline text-center${
                pathname === l.to ? 'bg-green-light text-green-dark' : 'text-gray-500 hover:text-navy hover:bg-gray-100'
              }`}
            >
              {l.label}
              {l.badge && <span className="ml-1.5 bg-amber text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{l.badge}</span>}
            </Link>
          ))}
        </div>

        {/* Auth — fixed right */}
        <div className="hidden md:flex items-center flex-shrink-0">
          {isAuthenticated ? (
            <button onClick={() => { logout(); navigate('/'); }}
              className="text-sm text-gray-400 hover:text-danger transition cursor-pointer border-0 bg-transparent">
              Logout
            </button>
          ) : (
            <Link to="/login" className="btn-primary text-sm px-4 py-2 no-underline">Admin Login</Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden ml-auto p-2 rounded-lg hover:bg-gray-100 border-0 bg-transparent cursor-pointer"
          onClick={() => setMenuOpen(!menuOpen)}>
          <div className="w-5 h-0.5 bg-navy mb-1" /><div className="w-5 h-0.5 bg-navy mb-1" /><div className="w-5 h-0.5 bg-navy" />
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 flex flex-col gap-2">
          {publicLinks.map(l => (
            <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)}
              className="block px-4 py-2.5 rounded-lg text-sm font-medium text-navy hover:bg-gray-50 no-underline">{l.label}</Link>
          ))}
          {isAuthenticated && adminLinks.map(l => (
            <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)}
              className="block px-4 py-2.5 rounded-lg text-sm font-medium text-navy hover:bg-gray-50 no-underline">{l.label}</Link>
          ))}
          {isAuthenticated
            ? <button onClick={() => { logout(); navigate('/'); setMenuOpen(false); }} className="text-left px-4 py-2.5 text-sm text-danger border-0 bg-transparent cursor-pointer">Logout</button>
            : <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-primary text-center text-sm no-underline">Admin Login</Link>
          }
        </div>
      )}
    </nav>
  );
}
