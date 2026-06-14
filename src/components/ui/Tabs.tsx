'use client';

import React, { useState } from 'react';
import styles from './Tabs.module.css';

interface Tab {
    id: string;
    label: string;
    content: React.ReactNode;
}

interface TabsProps {
    tabs: Tab[];
    defaultTab?: string;
}

export function Tabs({ tabs, defaultTab }: TabsProps) {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

    return (
        <div className={styles.tabsContainer}>
            <div className={styles.tabsHeader}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`${styles.tabBtn} ${activeTab === tab.id ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className={styles.tabContent}>
                {tabs.find(t => t.id === activeTab)?.content}
            </div>
        </div>
    );
}
