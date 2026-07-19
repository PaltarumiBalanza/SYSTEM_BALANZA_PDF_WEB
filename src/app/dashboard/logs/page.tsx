'use client';

import { useState, useEffect } from 'react';
import { User, FileText, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import styles from './logs.module.css';
import { supabase } from '@/lib/supabaseClient';

export default function LogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('audit_documents')
                    .select(`
                        id,
                        action,
                        modification_date,
                        documents (
                            name
                        ),
                        users (
                            first_name,
                            last_name
                        )
                    `)
                    .order('modification_date', { ascending: false })
                    .limit(25);

                if (error) throw error;

                const mapped = (data || []).map((t: any) => {
                    const userFull = t.users
                        ? `${t.users.first_name} ${t.users.last_name || ''}`.trim()
                        : 'Sistema';

                    let type = 'info';
                    let icon = FileText;
                    let actionDesc = 'modificó el reporte';

                    if (t.action === 'CREATE') {
                        type = 'info';
                        icon = User;
                        actionDesc = 'subió un nuevo reporte';
                    } else if (t.action === 'CLOSE') {
                        type = 'success';
                        icon = CheckCircle;
                        actionDesc = 'autorizó y firmó el reporte';
                    } else if (t.action === 'ERROR_MARKED') {
                        type = 'alert';
                        icon = AlertCircle;
                        actionDesc = 'marcó con error el reporte';
                    } else if (t.action === 'DELETE') {
                        type = 'alert';
                        icon = AlertTriangle;
                        actionDesc = 'eliminó el reporte';
                    }

                    const timeDiff = new Date().getTime() - new Date(t.modification_date).getTime();
                    const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
                    let timeStr = new Date(t.modification_date).toLocaleString('es-PE', { timeZone: 'America/Lima' });
                    
                    if (hoursDiff === 0) {
                        const mins = Math.floor(timeDiff / (1000 * 60));
                        timeStr = mins <= 1 ? 'Hace un momento' : `Hace ${mins} minutos`;
                    } else if (hoursDiff < 24) {
                        timeStr = `Hace ${hoursDiff} horas`;
                    }

                    return {
                        id: t.id,
                        type,
                        user: userFull,
                        action: actionDesc,
                        target: t.documents?.name || 'Reporte Eliminado',
                        time: timeStr,
                        icon
                    };
                });

                setLogs(mapped);
            } catch (err) {
                console.error('Error fetching logs:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Trazabilidad de Documentos</h1>
                <p className={styles.subtitle}>Historial de cambios y auditoría del sistema.</p>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
                    <div style={{ width: '2.5rem', height: '2.5rem', border: '3px solid rgba(212,160,23,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <style>{`
                        @keyframes spin { to { transform: rotate(360deg); } }
                    `}</style>
                </div>
            ) : (
                <div className={styles.timeline}>
                    {logs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            No hay logs registrados en el sistema.
                        </div>
                    ) : (
                        logs.map(log => {
                            const Icon = log.icon;
                            return (
                                <div key={log.id} className={styles.logItem}>
                                    <div className={`${styles.iconWrapper} ${styles[log.type]}`}>
                                        <Icon size={20} />
                                    </div>
                                    <div className={styles.content}>
                                        <div className={styles.logHeader}>
                                            <span className={styles.logUser}>{log.user}</span>
                                            <span className={styles.logTime}>{log.time}</span>
                                        </div>
                                        <p className={styles.logMessage}>
                                            {log.action} <strong>{log.target}</strong>
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
