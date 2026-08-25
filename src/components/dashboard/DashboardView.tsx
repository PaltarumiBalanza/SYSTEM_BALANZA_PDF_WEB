'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileWarning, CheckCircle, AlertCircle, Eye, Trash2, History, MessageSquare, ClipboardCheck, Edit, Loader2, Check, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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
    const [editingId, setEditingId] = useState<string | null>(null);
    const [tempName, setTempName] = useState('');
    const [renamingId, setRenamingId] = useState<string | null>(null);

    // Estado para ordenación tipo Excel por columnas (Nombre, Fecha, Estado, Región, Creador)
    const [sortColumn, setSortColumn] = useState<'name' | 'date' | 'status' | 'region' | 'creator' | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const paramFilter = params.get('filter');
            if (paramFilter) {
                setFilter(paramFilter);
            }
        }
    }, []);

    const sanitizeFileName = (fileName: string): string => {
        return fileName
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remueve acentos
            .replace(/[ñÑ]/g, "n")
            .replace(/[^a-zA-Z0-9.\s-]/g, "_"); // Mantiene espacios y caracteres alfanuméricos válidos
    };

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
                    file_link,
                    users:users!user_id (first_name, last_name)
                `)
                .eq('company', company)
                .order('id', { ascending: false });

            if (error) throw error;

            const formatted = (data || []).map((doc: any) => {
                let timestamp = 0;
                let dateFormatted = '';
                if (doc.creation_date) {
                    const hasTz = /[Zz]|[+-]\d{2}:?\d{2}$/.test(doc.creation_date);
                    const cleanStr = doc.creation_date.includes('T') ? doc.creation_date : doc.creation_date.replace(' ', 'T');
                    const finalStr = hasTz ? cleanStr : `${cleanStr}Z`;
                    const parsed = new Date(finalStr);
                    if (!isNaN(parsed.getTime())) {
                        timestamp = parsed.getTime();
                        dateFormatted = parsed.toLocaleString('es-PE', { 
                            timeZone: 'America/Lima',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        });
                    }
                }
                return {
                    id: String(doc.id),
                    name: doc.name,
                    status: doc.status === 'PENDIENTE' ? 'pending' : doc.status === 'HECHO' ? 'success' : (doc.status === 'CERRADO' || doc.status === 'CERRADO POR BALANZA') ? 'closed' : doc.status === 'OBSERVADO' ? 'observed' : 'error',
                    region: doc.region || 'General',
                    creator: doc.users ? `${doc.users.first_name} ${doc.users.last_name || ''}`.trim() : 'Sistema',
                    date: dateFormatted,
                    timestamp: timestamp,
                    comments: 0,
                    hasTrace: true,
                    fileLink: doc.file_link
                };
            });

            setReports(formatted);
        } catch (err) {
            console.error('Error al obtener reportes:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRename = async (id: string) => {
        if (!tempName.trim()) {
            alert('El nombre del archivo no puede estar vacío.');
            return;
        }

        const cleanName = sanitizeFileName(tempName.trim());
        if (!cleanName) {
            alert('El nombre del archivo no es válido.');
            return;
        }

        setRenamingId(id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                alert('No se pudo verificar la sesión. Inicie sesión nuevamente.');
                return;
            }

            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/rename-document`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    documentId: parseInt(id),
                    newName: cleanName
                })
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                throw new Error(result.error || 'Error al renombrar el reporte.');
            }

            setReports(prev => prev.map(r => r.id === id ? { 
                ...r, 
                name: result.document.name,
                date: (() => {
                    const docDate = result.document.creation_date;
                    if (!docDate) return r.date;
                    const hasTz = /[Zz]|[+-]\d{2}:?\d{2}$/.test(docDate);
                    const cleanStr = docDate.includes('T') ? docDate : docDate.replace(' ', 'T');
                    const finalStr = hasTz ? cleanStr : `${cleanStr}Z`;
                    const parsed = new Date(finalStr);
                    return isNaN(parsed.getTime()) ? r.date : parsed.toLocaleString('es-PE', { 
                        timeZone: 'America/Lima',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    });
                })()
            } : r));
            
            setEditingId(null);
            alert('Reporte renombrado con éxito.');
        } catch (err: any) {
            alert('Error al renombrar: ' + err.message);
        } finally {
            setRenamingId(null);
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

    const handleSort = (col: 'name' | 'date' | 'status' | 'region' | 'creator') => {
        if (sortColumn === col) {
            if (sortDirection === 'asc') {
                setSortDirection('desc');
            } else {
                setSortColumn(null);
                setSortDirection('asc');
            }
        } else {
            setSortColumn(col);
            setSortDirection('asc');
        }
    };

    const handleOpenEditor = (docId: string) => {
        const currentFrom = `${window.location.pathname}${filter !== 'all' ? `?filter=${filter}` : ''}`;
        router.push(`/editor/${docId}?from=${encodeURIComponent(currentFrom)}`);
    };

    const searchedData = reports.filter(r => {
        const query = searchQuery.toLowerCase();
        return r.id.toLowerCase().includes(query) || 
               r.name.toLowerCase().includes(query) || 
               r.creator.toLowerCase().includes(query) || 
               r.region.toLowerCase().includes(query);
    });

    const filteredData = filter === 'all' ? searchedData : searchedData.filter(d => d.status === filter);

    const sortedAndFilteredData = [...filteredData].sort((a, b) => {
        if (!sortColumn) return 0;
        if (sortColumn === 'date') {
            const valA = a.timestamp || 0;
            const valB = b.timestamp || 0;
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        let valA = String(a[sortColumn] || '').toLowerCase();
        let valB = String(b[sortColumn] || '').toLowerCase();
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const renderSortHeader = (label: string, col: 'name' | 'date' | 'status' | 'region' | 'creator') => {
        const isActive = sortColumn === col;
        return (
            <th 
                onClick={() => handleSort(col)} 
                style={{ cursor: 'pointer', userSelect: 'none' }}
                title={`Ordenar por ${label}`}
            >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>{label}</span>
                    {isActive ? (
                        sortDirection === 'asc' ? <ArrowUp size={14} color="var(--primary)" /> : <ArrowDown size={14} color="var(--primary)" />
                    ) : (
                        <ArrowUpDown size={13} style={{ opacity: 0.4 }} />
                    )}
                </div>
            </th>
        );
    };

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
                        <button className={`${styles.filterBtn} ${filter === 'observed' ? styles.active : ''}`} onClick={() => setFilter('observed')}>Observados</button>
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
                                    {renderSortHeader('Nombre Documento', 'name')}
                                    {renderSortHeader('Fecha', 'date')}
                                    {renderSortHeader('Estado', 'status')}
                                    {renderSortHeader('Región', 'region')}
                                    {renderSortHeader('Creador', 'creator')}
                                    <th>Trazabilidad</th>
                                    <th>Comentarios</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedAndFilteredData.map(row => (
                                    <tr key={row.id}>
                                        {editingId === row.id ? (
                                            <td style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '1rem 0.5rem', minWidth: '220px' }}>
                                                <input
                                                    type="text"
                                                    value={tempName}
                                                    onChange={(e) => setTempName(e.target.value)}
                                                    disabled={renamingId === row.id}
                                                    style={{
                                                        backgroundColor: 'var(--background)',
                                                        border: '1px solid var(--border)',
                                                        color: 'var(--text-primary)',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: 'var(--radius-sm)',
                                                        fontSize: '0.8rem',
                                                        width: '140px',
                                                        outline: 'none'
                                                    }}
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRename(row.id);
                                                        if (e.key === 'Escape') setEditingId(null);
                                                    }}
                                                />
                                                <button
                                                    onClick={() => handleRename(row.id)}
                                                    disabled={renamingId === row.id}
                                                    title="Guardar nombre"
                                                    style={{
                                                        padding: '0.25rem',
                                                        backgroundColor: 'var(--primary)',
                                                        color: 'var(--surface)',
                                                        border: 'none',
                                                        borderRadius: 'var(--radius-sm)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    {renamingId === row.id ? (
                                                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                                    ) : (
                                                        <Check size={14} />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    disabled={renamingId === row.id}
                                                    title="Cancelar"
                                                    style={{
                                                        padding: '0.25rem',
                                                        backgroundColor: 'transparent',
                                                        color: 'var(--text-secondary)',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    <X size={14} />
                                                </button>
                                                <style>{`
                                                    @keyframes spin {
                                                        to { transform: rotate(360deg); }
                                                    }
                                                `}</style>
                                            </td>
                                        ) : (
                                            <td style={{ fontWeight: 500, fontSize: '0.8rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.name}>{row.name}</td>
                                        )}
                                        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{row.date}</td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${styles[row.status]}`}>
                                                {row.status === 'pending' ? 'Pendiente' : row.status === 'success' ? 'Completado' : row.status === 'closed' ? 'Cerrado Balanza' : row.status === 'observed' ? 'Observado' : 'Error'}
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
                                            <button className={styles.actionBtn} title="Ver / Editar Documento" onClick={() => handleOpenEditor(row.id)}>
                                                <Eye size={16} /> Ver PDF
                                            </button>
                                            <button 
                                                className={styles.actionBtn} 
                                                title="Renombrar Reporte" 
                                                onClick={() => {
                                                    setTempName(row.name.replace(/\.[^/.]+$/, ""));
                                                    setEditingId(row.id);
                                                }}
                                            >
                                                <Edit size={16} />
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
