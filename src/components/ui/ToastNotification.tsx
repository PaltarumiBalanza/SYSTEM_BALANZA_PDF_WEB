'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';

export function ToastNotification() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Simulate real-time event arriving 3 seconds after load
        const timer = setTimeout(() => {
            setShow(true);
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    if (!show) return null;

    return (
        <div style={{
            position: 'fixed', bottom: '2rem', right: '2rem',
            backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '1rem',
            display: 'flex', alignItems: 'center', gap: '1rem',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', zIndex: 50,
            animation: 'slideIn 0.3s ease-out forwards'
        }}>
            <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: 'var(--primary)', padding: '0.6rem', borderRadius: '50%', display: 'flex' }}>
                <Bell size={20} />
            </div>
            <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Nuevo Reporte de Balanza</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Desde Mina Antamina - hace unos instantes</div>
            </div>
            <button
                style={{ marginLeft: '1rem', fontSize: '1.5rem', color: 'var(--text-secondary)', transition: 'color 0.2s', padding: '0.25rem' }}
                onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                onClick={() => setShow(false)}
            >
                &times;
            </button>

            <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
        </div>
    );
}
