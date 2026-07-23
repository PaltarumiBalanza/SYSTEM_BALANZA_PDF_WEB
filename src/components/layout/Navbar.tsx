'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './layout.module.css';
import { Bell, Menu, LogOut, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export function Navbar({ toggleSidebar }: { toggleSidebar: () => void }) {
    const router = useRouter();
    const [profile, setProfile] = useState<{ firstName: string; lastName: string; role: string } | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: userData } = await supabase
                    .from('users')
                    .select(`
                        first_name,
                        last_name,
                        user_roles (
                            roles (
                                name
                            )
                        )
                    `)
                    .eq('id', user.id)
                    .single() as any;

                if (userData) {
                    const roleName = userData.user_roles?.[0]?.roles?.name || 'VIEWER';
                    const friendlyRole = roleName === 'ADMIN' ? 'Administrador' : (roleName === 'EDITOR' || roleName === 'SUPERVISOR') ? 'Comercial' : 'Balanza';
                    setProfile({
                        firstName: userData.first_name || '',
                        lastName: userData.last_name || '',
                        role: friendlyRole
                    });
                }
            } catch (err) {
                console.error('Error fetching profile for navbar:', err);
            }
        };

        fetchProfile();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const initials = profile 
        ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase() 
        : 'U';
    const fullName = profile 
        ? `${profile.firstName} ${profile.lastName}`.trim() 
        : 'Cargando...';
    const roleLabel = profile 
        ? profile.role 
        : 'Cargando...';

    return (
        <header className={styles.navbar}>
            <div className={styles.navbarTitle}>
                <button className={styles.menuButton} onClick={toggleSidebar}>
                    <Menu size={20} />
                </button>
                PDF Mining Hub
            </div>
            <div className={styles.profile}>
                <button style={{ color: 'var(--text-secondary)', transition: 'color 0.2s', cursor: 'pointer', background: 'none', border: 'none' }}
                    onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>
                    <Bell size={20} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', borderLeft: '1px solid var(--border)', paddingLeft: '1.25rem', position: 'relative' }}>
                    <div className={styles.profileMenu} onClick={() => setDropdownOpen(!dropdownOpen)} style={{ cursor: 'pointer', position: 'relative' }}>
                        <div className={styles.avatar}>{initials}</div>
                        <div className={styles.profileDetails}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{fullName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{roleLabel}</div>
                        </div>
                        <ChevronDown size={14} color="var(--text-secondary)" />

                        {dropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '0.75rem',
                                backgroundColor: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
                                minWidth: '170px',
                                zIndex: 1000,
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); router.push('/dashboard/settings'); }}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        background: 'none',
                                        border: 'none',
                                        textAlign: 'left',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        transition: 'background-color 0.2s',
                                        width: '100%'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    Configuración
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); handleLogout(); }}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        background: 'none',
                                        border: 'none',
                                        textAlign: 'left',
                                        color: 'var(--status-error)',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        transition: 'background-color 0.2s',
                                        borderTop: '1px solid var(--border)',
                                        width: '100%'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.05)'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    Cerrar Sesión
                                </button>
                            </div>
                        )}
                    </div>
                    <button onClick={handleLogout} className={styles.logoutBtn} title="Salir sesión" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <LogOut size={16} />
                        <span>Salir</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
