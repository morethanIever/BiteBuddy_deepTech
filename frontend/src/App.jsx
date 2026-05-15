import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './lib/toast';
import Nav from './components/Nav';
import ProtectedRoute from './components/ProtectedRoute';

import Landing         from './pages/Landing';
import MapPage         from './pages/MapPage';
import VerifyPage      from './pages/VerifyPage';
import Dashboard       from './pages/Dashboard';
import Login           from './pages/Login';
import Pricing         from './pages/Pricing';
import Apply           from './pages/Apply';
import DeviceSimulator from './pages/DeviceSimulator';
import Applications   from './pages/Applications';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public QR verify — no nav, clean mobile certificate */}
            <Route path="/verify/:id" element={<VerifyPage />} />

            {/* All other pages share the nav */}
            <Route path="/*" element={
              <>
                <Nav />
                <Routes>
                  <Route path="/"         element={<Landing />} />
                  <Route path="/map"      element={<MapPage />} />
                  <Route path="/pricing"  element={<Pricing />} />
                  <Route path="/apply"    element={<Apply />} />
                  <Route path="/login"    element={<Login />} />
                  <Route path="/simulator" element={
                    <ProtectedRoute><DeviceSimulator /></ProtectedRoute>
                  } />
                  <Route path="/dashboard" element={
                    <ProtectedRoute><Dashboard /></ProtectedRoute>
                  } />
                  <Route path="/applications" element={
                    <ProtectedRoute><Applications /></ProtectedRoute>
                  } />
                  <Route path="*" element={
                    <div className="pt-16 min-h-screen flex items-center justify-center text-center px-4">
                      <div>
                        <div className="text-6xl mb-4">🦠</div>
                        <h1 className="font-head text-3xl font-bold mb-2">404 — Not Found</h1>
                        <a href="/" className="btn-primary no-underline mt-4 inline-block">Go Home</a>
                      </div>
                    </div>
                  } />
                </Routes>
              </>
            } />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
