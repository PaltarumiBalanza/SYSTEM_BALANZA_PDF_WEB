'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './layout.module.css';
import { Bell, Menu, LogOut, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export function Navbar({ toggleSidebar }: { toggleSidebar: () => void }) {
    const router = useRouter();
    const [profile, setProfile] = useState<{ firstName: string; lastName: string; role: string } | null>(null);

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
                    const roleName = userData.user_roles?.[0]?.roles?.name || 'OPERATOR';
                    const friendlyRole = roleName === 'ADMIN' ? 'Administrador' : roleName === 'SUPERVISOR' ? 'Supervisor Regional' : 'Operador';
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

    const handleLogout = async (e: React.MouseEvent) => {
        e.preventDefault();
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', borderLeft: '1px solid var(--border)', paddingLeft: '1.25rem' }}>
                    <div className={styles.profileMenu}>
                        <div className={styles.avatar}>{initials}</div>
                        <div className={styles.profileDetails}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{fullName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{roleLabel}</div>
                        </div>
                        <ChevronDown size={14} color="var(--text-secondary)" />
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
