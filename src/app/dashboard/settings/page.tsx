'use client';

import React, { useState, useEffect } from 'react';
import { Moon, Sun, Settings, Bell, Shield, Database, Globe, User, Palette } from 'lucide-react';
import styles from '../dashboard.module.css';

export default function SettingsPage() {
    const [theme, setTheme] = useState('dark');
    const [notifications, setNotifications] = useState(true);

    // Initialize theme from document attribute (set by layout or default)
    useEffect(() => {
        const savedTheme = localStorage.getItem('paltarumi-theme') || 'dark';
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
    }, []);

    const toggleTheme = (newTheme: string) => {
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('paltarumi-theme', newTheme);
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

                {/* Account Settings Placeholder */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ color: 'var(--primary)', background: 'var(--primary-light)', padding: '10px', borderRadius: '12px' }}><User size={24} /></div>
                        <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Cuenta Personal</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Elias Carmin (Supervisor)</p>
                        </div>
                    </div>
                    <button style={{ width: '100%', padding: '0.875rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>Cambiar Contraseña</button>
                </div>
            </div>
        </div>
    );
}
