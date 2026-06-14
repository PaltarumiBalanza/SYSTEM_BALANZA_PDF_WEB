import { User, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import styles from './logs.module.css';

const LOGS = [
    { id: 1, type: 'success', user: 'Elías Carmín', action: 'autorizó el', target: 'Reporte_1024', time: 'Hoy, 10:45 AM', icon: CheckCircle },
    { id: 2, type: 'info', user: 'Juan Pérez', action: 'agregó 2 páginas al', target: 'Reporte_1024', time: 'Hoy, 09:30 AM', icon: FileText },
    { id: 3, type: 'alert', user: 'Sistema', action: 'detectó un error de lectura en', target: 'Reporte_1022', time: 'Ayer, 16:20 PM', icon: AlertTriangle },
    { id: 4, type: 'info', user: 'Ana Torres', action: 'subió un nuevo reporte desde', target: 'Mina Cusco', time: 'Ayer, 11:15 AM', icon: User },
];

export default function LogsPage() {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Trazabilidad de Documentos</h1>
                <p className={styles.subtitle}>Historial de cambios y auditoría del sistema.</p>
            </div>

            <div className={styles.timeline}>
                {LOGS.map(log => {
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
                })}
            </div>
        </div>
    );
}
