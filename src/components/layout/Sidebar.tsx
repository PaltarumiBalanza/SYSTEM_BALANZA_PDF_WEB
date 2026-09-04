'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Activity, LogOut, Settings, ClipboardCheck, Users, Building, Briefcase } from 'lucide-react';
import styles from './layout.module.css';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function Sidebar({ isOpen }: { isOpen: boolean }) {
    const pathname = usePathname();
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        const checkUserRole = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data } = await supabase
                        .from('user_roles')
                        .select('roles(name)')
                        .eq('user_id', user.id)
                        .single() as any;
                    
                    if (data?.roles?.name) {
                        setRole(data.roles.name);
                    }
                }
            } catch (err) {
                console.error('Error checking user role in sidebar:', err);
            }
        };
        checkUserRole();
    }, []);

    const links = [
        { href: '/dashboard', label: 'PSAC', icon: FileText },
        { href: '/dashboard/ecogold', label: 'ECOGOLD', icon: Building },
        { href: '/dashboard/customers', label: 'Customers', icon: Briefcase },
        ...(role === 'ADMIN' || role === 'EDITOR' ? [
            { href: '/dashboard/audit', label: 'Auditoría', icon: ClipboardCheck }
        ] : role === 'VIEWER' ? [
            { href: '/dashboard/audit', label: 'Descarga Masiva', icon: ClipboardCheck }
        ] : []),
        ...(role === 'ADMIN' ? [
            { href: '/dashboard/users', label: 'Usuarios', icon: Users }
        ] : []),
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
