'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { ToastNotification } from '@/components/ui/ToastNotification';
import styles from '@/components/layout/layout.module.css';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useEffect(() => {
        const savedTheme = localStorage.getItem('paltarumi-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }, []);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    return (
        <div className={styles.layout}>
            <Sidebar isOpen={isSidebarOpen} />
            <main className={styles.main}>
                <Navbar toggleSidebar={toggleSidebar} />
                <div className={styles.content}>
                    {children}
                </div>
            </main>
            <ToastNotification />
        </div>
    );
}
