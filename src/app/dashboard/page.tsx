'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileWarning, CheckCircle, AlertCircle, Eye, Trash2, History, MessageSquare } from 'lucide-react';
import styles from './dashboard.module.css';
import { Modal, TraceabilityContent, CommentsContent } from '@/components/ui/Modal';

const MOCK_DATA = [
    { id: '1024', name: 'Balanza_LIM_Reporte_Mar_2026.pdf', status: 'pending', region: 'Lima', creator: 'Juan Pérez', date: '2026-03-14 08:30 AM', comments: 3, hasTrace: true },
    { id: '1023', name: 'Pesaje_ANT_Turno_A_2026Q1.pdf', status: 'success', region: 'Antamina', creator: 'Carlos Ruíz', date: '2026-03-13 16:45 PM', comments: 0, hasTrace: true },
    { id: '1022', name: 'Control_CUS_Semana12_2026.pdf', status: 'error', region: 'Cusco', creator: 'Ana Torres', date: '2026-03-13 11:20 AM', comments: 12, hasTrace: true },
    { id: '1021', name: 'Informe_LIM_Planta_Norte_Mar.pdf', status: 'success', region: 'Lima', creator: 'Juan Pérez', date: '2026-03-12 09:15 AM', comments: 5, hasTrace: true },
    { id: '1020', name: 'Reporte_ANT_Extraccion_002.pdf', status: 'pending', region: 'Antamina', creator: 'Luis Gómez', date: '2026-03-12 07:00 AM', comments: 1, hasTrace: true },
];

export default function DashboardPage() {
    const router = useRouter();
    const [filter, setFilter] = useState('all');
    const [openModal, setOpenModal] = useState<'none' | 'trace' | 'comments'>('none');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const filteredData = filter === 'all' ? MOCK_DATA : MOCK_DATA.filter(d => d.status === filter);

    const handleOpenTrace = (id: string) => {
        setSelectedId(id);
        setOpenModal('trace');
    };

    const handleOpenComments = (id: string) => {
        setSelectedId(id);
        setOpenModal('comments');
    };

    return (
        <div className={styles.container}>
            <Modal 
                isOpen={openModal === 'trace'} 
                onClose={() => setOpenModal('none')}
                title={`Trazabilidad - Reporte #${selectedId}`}
                icon={<History size={20} color="var(--primary)" />}
            >
                <TraceabilityContent reportId={selectedId || ''} />
            </Modal>

            <Modal 
                isOpen={openModal === 'comments'} 
                onClose={() => setOpenModal('none')}
                title={`Comentarios de Usuarios - Reporte #${selectedId}`}
                icon={<MessageSquare size={20} color="var(--status-success)" />}
            >
                <CommentsContent reportId={selectedId || ''} />
            </Modal>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Panel de Control</h1>
                    <p className={styles.subtitle}>Gestión de autorizaciones de reportes PDF de balanzas.</p>
                </div>
            </div>

            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.pending}`}>
                        <FileWarning size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <h3>2</h3>
                        <p>Pendientes</p>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.success}`}>
                        <CheckCircle size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <h3>145</h3>
                        <p>Completados</p>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.error}`}>
                        <AlertCircle size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <h3>1</h3>
                        <p>Con Errores</p>
                    </div>
                </div>
            </div>

            <div className={styles.tableSection}>
                <div className={styles.tableToolbar}>
                    <div className={styles.searchBox}>
                        <Search size={18} color="var(--text-secondary)" />
                        <input type="text" placeholder="Buscar por ID, Creador o Región..." />
                    </div>
                    <div className={styles.filterGroup}>
                        <button className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`} onClick={() => setFilter('all')}>Todos</button>
                        <button className={`${styles.filterBtn} ${filter === 'pending' ? styles.active : ''}`} onClick={() => setFilter('pending')}>Pendientes</button>
                        <button className={`${styles.filterBtn} ${filter === 'success' ? styles.active : ''}`} onClick={() => setFilter('success')}>Completados</button>
                        <button className={`${styles.filterBtn} ${filter === 'error' ? styles.active : ''}`} onClick={() => setFilter('error')}>Errores</button>
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Nombre Documento</th>
                                <th>Estado</th>
                                <th>Región</th>
                                <th>Creador</th>
                                <th>Trazabilidad</th>
                                <th>Comentarios</th>
                                <th style={{ textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map(row => (
                                <tr key={row.id}>
                                    <td style={{ fontWeight: 500, fontSize: '0.8rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.name}>{row.name}</td>
                                    <td>
                                        <span className={`${styles.statusBadge} ${styles[row.status]}`}>
                                            {row.status === 'pending' ? 'Pendiente' : row.status === 'success' ? 'Hecho' : 'Error'}
                                        </span>
                                    </td>
                                    <td>{row.region}</td>
                                    <td>{row.creator}</td>
                                    <td>
                                        <button className={styles.traceBtn} title="Ver Trazabilidad" onClick={() => handleOpenTrace(row.id)}>
                                            <History size={16} />
                                            <span>Historial</span>
                                        </button>
                                    </td>
                                    <td>
                                        <button className={styles.commentBtn} title="Ver Comentarios" onClick={() => handleOpenComments(row.id)}>
                                            <MessageSquare size={16} />
                                            {row.comments > 0 && <span className={styles.badgeCount}>{row.comments}</span>}
                                            <span>Feedback</span>
                                        </button>
                                    </td>
                                    <td className={styles.actionsCell}>
                                        <button className={styles.actionBtn} title="Ver / Editar Documento" onClick={() => router.push(`/editor/${row.id}`)}>
                                            <Eye size={16} /> Ver PDF
                                        </button>
                                        <button className={styles.deleteBtn} title="Eliminar Reporte">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
