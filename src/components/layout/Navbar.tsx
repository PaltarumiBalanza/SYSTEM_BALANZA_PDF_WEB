'use client';

import styles from './layout.module.css';
import { Bell, Menu, LogOut, ChevronDown } from 'lucide-react';
import Link from 'next/link';

export function Navbar({ toggleSidebar }: { toggleSidebar: () => void }) {
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
                        <div className={styles.avatar}>EC</div>
                        <div className={styles.profileDetails}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Elias Carmin</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Supervisor Regional</div>
                        </div>
                        <ChevronDown size={14} color="var(--text-secondary)" />
                    </div>
                    <Link href="/login" className={styles.logoutBtn} title="Salir sesión">
                        <LogOut size={16} />
                        <span>Salir</span>
                    </Link>
                </div>
            </div>
        </header>
    );
}
