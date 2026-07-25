'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileWarning, CheckCircle, AlertCircle, Eye, Trash2, History, MessageSquare, ClipboardCheck } from 'lucide-react';
import styles from '@/app/dashboard/dashboard.module.css';
import { Modal, TraceabilityContent, CommentsContent } from '@/components/ui/Modal';
import { supabase } from '@/lib/supabaseClient';

interface DashboardViewProps {
    company: 'PSAC' | 'ECOGOLD';
}

export function DashboardView({ company }: DashboardViewProps) {
    const router = useRouter();
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [openModal, setOpenModal] = useState<'none' | 'trace' | 'comments'>('none');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchReports = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('documents')
                .select(`
                    id,
                    name,
                    status,
                    creation_date,
                    user_id,
                    region,
                    company,
                    users:users!user_id (first_name, last_name)
                `)
                .eq('company', company)
                .order('id', { ascending: false });

            if (error) throw error;

            const formatted = (data || []).map((doc: any) => ({
                id: String(doc.id),
                name: doc.name,
                status: doc.status === 'PENDIENTE' ? 'pending' : doc.status === 'HECHO' ? 'success' : doc.status === 'CERRADO POR BALANZA' ? 'closed' : 'error',
                region: doc.region || 'General',
                creator: doc.users ? `${doc.users.first_name} ${doc.users.last_name || ''}`.trim() : 'Sistema',
                date: (() => {
                    if (!doc.creation_date) return '';
                    const hasTz = /[Zz]|[+-]\d{2}:?\d{2}$/.test(doc.creation_date);
                    const cleanStr = doc.creation_date.includes('T') ? doc.creation_date : doc.creation_date.replace(' ', 'T');
                    const finalStr = hasTz ? cleanStr : `${cleanStr}Z`;
                    const parsed = new Date(finalStr);
                    return isNaN(parsed.getTime()) ? '' : parsed.toLocaleString('es-PE', { 
                        timeZone: 'America/Lima',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    });
                })(),
                comments: 0,
                hasTrace: true
            }));

            setReports(formatted);
        } catch (err) {
            console.error('Error al obtener reportes:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [company]);

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar este reporte permanentemente?')) return;
        
        try {
            const { error } = await supabase
                .from('documents')
                .delete()
                .eq('id', parseInt(id));

            if (error) throw error;
            setReports(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            alert('Error al eliminar reporte: ' + (err as any).message);
        }
    };

    const searchedData = reports.filter(r => {
        const query = searchQuery.toLowerCase();
        return r.id.toLowerCase().includes(query) || 
               r.name.toLowerCase().includes(query) || 
               r.creator.toLowerCase().includes(query) || 
               r.region.toLowerCase().includes(query);
    });

    const filteredData = filter === 'all' ? searchedData : searchedData.filter(d => d.status === filter);

    const pendingCount = reports.filter(r => r.status === 'pending').length;
    const closedCount = reports.filter(r => r.status === 'closed').length;
    const successCount = reports.filter(r => r.status === 'success').length;
    const errorCount = reports.filter(r => r.status === 'error').length;

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
                    <h1 className={styles.title}>Panel de Control - {company}</h1>
                    <p className={styles.subtitle}>Gestión de autorizaciones de reportes PDF de balanzas para {company}.</p>
                </div>
            </div>

            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.pending}`}>
                        <FileWarning size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <h3>{pendingCount}</h3>
                        <p>Pendientes</p>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.closed}`}>
                        <ClipboardCheck size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <h3>{closedCount}</h3>
                        <p>Cerrados Balanza</p>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.success}`}>
                        <CheckCircle size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <h3>{successCount}</h3>
                        <p>Completados</p>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.error}`}>
                        <AlertCircle size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <h3>{errorCount}</h3>
                        <p>Con Errores</p>
                    </div>
                </div>
            </div>

            <div className={styles.tableSection}>
                <div className={styles.tableToolbar}>
                    <div className={styles.searchBox}>
                        <Search size={18} color="var(--text-secondary)" />
                        <input 
                            type="text" 
                            placeholder="Buscar por ID, Creador o Región..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className={styles.filterGroup}>
                        <button className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`} onClick={() => setFilter('all')}>Todos</button>
                        <button className={`${styles.filterBtn} ${filter === 'pending' ? styles.active : ''}`} onClick={() => setFilter('pending')}>Pendientes</button>
                        <button className={`${styles.filterBtn} ${filter === 'closed' ? styles.active : ''}`} onClick={() => setFilter('closed')}>Cerrados Balanza</button>
                        <button className={`${styles.filterBtn} ${filter === 'success' ? styles.active : ''}`} onClick={() => setFilter('success')}>Completados</button>
                        <button className={`${styles.filterBtn} ${filter === 'error' ? styles.active : ''}`} onClick={() => setFilter('error')}>Errores</button>
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                            <div style={{ width: '2rem', height: '2rem', border: '3px solid rgba(212,160,23,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <style>{`
                                @keyframes spin {
                                    to { transform: rotate(360deg); }
                                }
                            `}</style>
                        </div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Nombre Documento</th>
                                    <th>Fecha</th>
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
                                        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{row.date}</td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${styles[row.status]}`}>
                                                {row.status === 'pending' ? 'Pendiente' : row.status === 'success' ? 'Hecho' : row.status === 'closed' ? 'Cerrado Balanza' : 'Error'}
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
                                            <button className={styles.deleteBtn} title="Eliminar Reporte" onClick={() => handleDelete(row.id)}>
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
