'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { AlertCircle, LogOut } from 'lucide-react';
import styles from '@/components/ui/Modal.module.css';

export function AuthListener() {
    const router = useRouter();
    const pathname = usePathname();
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        if (pathname === '/login') return;

        const checkSession = async () => {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error || !session) {
                setIsExpired(true);
                return;
            }

            if (session.expires_at && session.expires_at * 1000 <= Date.now()) {
                setIsExpired(true);
            }
        };

        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (pathname === '/login') return;

            if (event === 'SIGNED_OUT' || !session) {
                setIsExpired(true);
            } else if (session?.expires_at && session.expires_at * 1000 <= Date.now()) {
                setIsExpired(true);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [pathname]);

    const handleRedirectToLogin = async () => {
        setIsExpired(false);
        try {
            await supabase.auth.signOut();
        } catch (e) {
            // Ignorar errores al desloguear si la sesión ya expiró
        }
        router.push('/login');
    };

    if (!isExpired) return null;

    return (
        <div className={styles.backdrop} style={{ zIndex: 99999 }}>
            <div className={styles.modal} style={{ maxWidth: '420px', border: '1px solid var(--status-error)' }}>
                <div className={styles.header}>
                    <h2><AlertCircle size={22} color="#ef4444" /> Inicio de Sesión Caducado</h2>
                </div>
                <div className={styles.body}>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.9rem' }}>
                        Su token de autenticación ha caducado por inactividad o expiración de seguridad.
                    </p>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: '0.5rem', fontSize: '0.9rem' }}>
                        Por favor, inicie sesión nuevamente para continuar trabajando en el sistema.
                    </p>
                </div>
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleRedirectToLogin}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.6rem 1.25rem',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        <LogOut size={16} /> Ir al Login
                    </button>
                </div>
            </div>
        </div>
    );
}
