'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Activity, LogOut, Settings, ClipboardCheck, Users } from 'lucide-react';
import styles from './layout.module.css';

export function Sidebar({ isOpen }: { isOpen: boolean }) {
    const pathname = usePathname();

    const links = [
        { href: '/dashboard', label: 'Reportes', icon: FileText },
        { href: '/dashboard/audit', label: 'Auditoría', icon: ClipboardCheck },
        { href: '/dashboard/users', label: 'Usuarios', icon: Users },
        { href: '/dashboard/settings', label: 'Configuración', icon: Settings },
    ];

    return (
        <aside className={`${styles.sidebar} ${!isOpen ? styles.sidebarHidden : ''}`}>
            <div className={styles.sidebarHeader} style={{ justifyContent: 'center', height: '80px' }}>
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center' }}>
                    <Image src="/paltarumi.png" alt="Paltarumi Logo" width={130} height={40} style={{ objectFit: 'contain' }} priority />
                </div>
            </div>
            <nav className={styles.nav}>
                {links.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`${styles.navLink} ${isActive ? styles.active : ''}`}
                        >
                            <Icon size={20} />
                            {link.label}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
