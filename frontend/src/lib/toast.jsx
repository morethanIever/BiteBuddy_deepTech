import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now();
    setToasts([{ id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
  }, []);

  const colors = {
    info:    'bg-navy text-white',
    success: 'bg-green text-white',
    warning: 'bg-amber text-white',
    error:   'bg-danger text-white',
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className={`toast-enter px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-xs ${colors[t.type]}`}>
              {t.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
