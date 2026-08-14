'use client';

import React, { useState, useEffect } from 'react';
import { Moon, Sun, Bell, User, Palette } from 'lucide-react';
import styles from '../dashboard.module.css';
import { supabase } from '@/lib/supabaseClient';

export default function SettingsPage() {
    const [theme, setTheme] = useState('dark');
    const [notifications, setNotifications] = useState(true);
    const [profile, setProfile] = useState<{ firstName: string; lastName: string; role: string; email: string } | null>(null);

    // Contraseña
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [updatingPassword, setUpdatingPassword] = useState(false);
    const [passError, setPassError] = useState('');
    const [passSuccess, setPassSuccess] = useState('');

    // Initialize theme from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem('paltarumi-theme') || 'dark';
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        // Fetch active profile
        const fetchProfile = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: userData } = await supabase
                    .from('users')
                    .select(`
                        first_name,
                        last_name,
                        email,
                        user_roles (
                            roles (
                                name
                            )
                        )
                    `)
                    .eq('id', user.id)
                    .single() as any;

                if (userData) {
                    const roleName = userData.user_roles?.[0]?.roles?.name || 'OPERATOR';
                    const friendlyRole = roleName === 'ADMIN' ? 'Administrador' : (roleName === 'EDITOR' || roleName === 'SUPERVISOR') ? 'Comercial' : 'Balanza';
                    setProfile({
                        firstName: userData.first_name || '',
                        lastName: userData.last_name || '',
                        role: friendlyRole,
                        email: userData.email || user.email || ''
                    });
                }
            } catch (err) {
                console.error('Error fetching profile for settings:', err);
            }
        };

        fetchProfile();
    }, []);

    const toggleTheme = (newTheme: string) => {
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('paltarumi-theme', newTheme);
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPassError('');
        setPassSuccess('');

        if (newPassword.length < 6) {
            setPassError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPassError('Las contraseñas no coinciden.');
            return;
        }

        setUpdatingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            setPassSuccess('Contraseña actualizada con éxito.');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setPassError(err.message || 'Error al actualizar la contraseña.');
        } finally {
            setUpdatingPassword(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Configuración</h1>
                    <p className={styles.subtitle}>Gestiona las preferencias del sistema y personalización.</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
                {/* Theme Selection */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ color: 'var(--primary)', background: 'var(--primary-light)', padding: '10px', borderRadius: '12px' }}><Palette size={24} /></div>
                        <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Personalización</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Elige la apariencia visual del sistema</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <button 
                            onClick={() => toggleTheme('light')}
                            style={{ 
                                padding: '1.5rem', 
                                border: `2px solid ${theme === 'light' ? 'var(--primary)' : 'var(--border)'}`, 
                                borderRadius: '16px', 
                                background: theme === 'light' ? 'var(--primary-light)' : 'transparent',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.75rem',
                                color: theme === 'light' ? 'var(--primary)' : 'var(--text-secondary)',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <Sun size={32} />
                            <span style={{ fontWeight: 600 }}>Modo Claro</span>
                        </button>
                        <button 
                            onClick={() => toggleTheme('dark')}
                            style={{ 
                                padding: '1.5rem', 
                                border: `2px solid ${theme === 'dark' ? 'var(--primary)' : 'var(--border)'}`, 
                                borderRadius: '16px', 
                                background: theme === 'dark' ? 'var(--primary-light)' : 'transparent',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.75rem',
                                color: theme === 'dark' ? 'var(--primary)' : 'var(--text-secondary)',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <Moon size={32} />
                            <span style={{ fontWeight: 600 }}>Modo Oscuro</span>
                        </button>
                    </div>
                </div>

                {/* Notifications */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ color: 'var(--primary)', background: 'var(--primary-light)', padding: '10px', borderRadius: '12px' }}><Bell size={24} /></div>
                        <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Notificaciones</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Correo y sistema de alertas</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--background)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Alertas de auditoría crítica</span>
                        <div 
                            onClick={() => setNotifications(!notifications)}
                            style={{ 
                                width: '48px', 
                                height: '24px', 
                                background: notifications ? 'var(--primary)' : 'rgba(255,255,255,0.1)', 
                                borderRadius: '12px', 
                                cursor: 'pointer',
                                position: 'relative',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <div style={{ 
                                position: 'absolute', 
                                top: '3px', 
                                left: notifications ? '27px' : '3px', 
                                width: '18px', 
                                height: '18px', 
                                background: 'white', 
                                borderRadius: '50%',
                                transition: 'all 0.3s ease'
                            }} />
                        </div>
                    </div>
                </div>

                {/* Account Settings */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ color: 'var(--primary)', background: 'var(--primary-light)', padding: '10px', borderRadius: '12px' }}><User size={24} /></div>
                        <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Cuenta Personal</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                {profile ? `${profile.firstName} ${profile.lastName} (${profile.role})` : 'Cargando perfil...'}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--background)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Correo Electrónico</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {profile ? profile.email : 'Cargando...'}
                        </div>
                    </div>
                </div>

                {/* Change Password Card */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ color: 'var(--primary)', background: 'var(--primary-light)', padding: '10px', borderRadius: '12px' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-key-round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Seguridad</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Actualiza tu contraseña de acceso</p>
                        </div>
                    </div>

                    <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Nueva Contraseña
                            </label>
                            <input 
                                type="password" 
                                placeholder="Mínimo 6 caracteres"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                style={{
                                    background: 'var(--background)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    padding: '0.6rem 0.8rem',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.875rem',
                                    outline: 'none',
                                    width: '100%'
                                }}
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Confirmar Contraseña
                            </label>
                            <input 
                                type="password" 
                                placeholder="Repite tu contraseña"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                style={{
                                    background: 'var(--background)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    padding: '0.6rem 0.8rem',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.875rem',
                                    outline: 'none',
                                    width: '100%'
                                }}
                                required
                            />
                        </div>

                        {passError && (
                            <div style={{ color: 'var(--status-error)', fontSize: '0.85rem', fontWeight: 500 }}>
                                ⚠️ {passError}
                            </div>
                        )}

                        {passSuccess && (
                            <div style={{ color: 'var(--status-success)', fontSize: '0.85rem', fontWeight: 500 }}>
                                ✓ {passSuccess}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={updatingPassword || !newPassword || !confirmPassword}
                            style={{
                                padding: '0.65rem 1.2rem',
                                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                width: '100%',
                                opacity: (updatingPassword || !newPassword || !confirmPassword) ? 0.6 : 1
                            }}
                        >
                            {updatingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
