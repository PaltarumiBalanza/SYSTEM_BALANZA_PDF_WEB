'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, Search, User, CheckSquare, Square, Shield } from 'lucide-react';
import styles from '../dashboard.module.css';
import { Tabs } from '@/components/ui/Tabs';
import { supabase } from '@/lib/supabaseClient';

export default function AuditPage() {
    const router = useRouter();
    const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
    const [userTrace, setUserTrace] = useState<any[]>([]);
    const [docTrace, setDocTrace] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchUser, setSearchUser] = useState('');
    const [searchDoc, setSearchDoc] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);

    const fetchAuditLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('audit_documents')
                .select(`
                    id,
                    action,
                    modification_date,
                    document_id,
                    documents (
                        name
                    ),
                    users (
                        first_name,
                        last_name,
                        email
                    )
                `)
                .order('modification_date', { ascending: false });

            if (error) throw error;

            // Formatear para Trazabilidad de Usuarios
            const formattedUsers = (data || []).map((t: any) => {
                const userFull = t.users
                    ? `${t.users.first_name} ${t.users.last_name || ''}`.trim()
                    : 'Sistema / Scraper';
                
                let friendlyAction = 'Modificación';
                if (t.action === 'CREATE') friendlyAction = 'Subida de Documento';
                if (t.action === 'CLOSE') friendlyAction = 'Aprobación de PDF';
                if (t.action === 'UPDATE') friendlyAction = 'Modificación de Hojas';
                if (t.action === 'DELETE') friendlyAction = 'Eliminación de Reporte';
                if (t.action === 'ERROR_MARKED') friendlyAction = 'Marcado como Error';

                return {
                    id: t.id,
                    user: userFull,
                    action: friendlyAction,
                    module: t.action === 'CREATE' ? 'Carga' : t.action === 'CLOSE' ? 'Firma' : 'Editor',
                    date: new Date(t.modification_date).toLocaleString('es-PE', { timeZone: 'America/Lima' }),
                    ip: t.users?.email || 'N/A'
                };
            });

            // Formatear para Trazabilidad de Documentos
            const formattedDocs = (data || []).map((t: any) => {
                const userFull = t.users
                    ? `${t.users.first_name} ${t.users.last_name || ''}`.trim()
                    : 'Sistema / Scraper';

                let friendlyAction = 'Modificación';
                if (t.action === 'CREATE') friendlyAction = 'Registro de Reporte';
                if (t.action === 'CLOSE') friendlyAction = 'Aprobación Final';
                if (t.action === 'UPDATE') friendlyAction = 'Páginas Modificadas';
                if (t.action === 'DELETE') friendlyAction = 'Eliminación';
                if (t.action === 'ERROR_MARKED') friendlyAction = 'Marcado con Error';

                return {
                    id: String(t.document_id),
                    name: t.documents?.name || 'Reporte Eliminado',
                    action: friendlyAction,
                    user: userFull,
                    date: new Date(t.modification_date).toLocaleString('es-PE', { timeZone: 'America/Lima' })
                };
            });

            setUserTrace(formattedUsers);
            setDocTrace(formattedDocs);
        } catch (err) {
            console.error('Error fetching audit logs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const verifyAdmin = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.push('/login');
                    return;
                }

                const { data, error } = await supabase
                    .from('user_roles')
                    .select('roles(name)')
                    .eq('user_id', user.id)
                    .single() as any;

                if (!error && data?.roles?.name === 'ADMIN') {
                    setIsAuthorized(true);
                    await fetchAuditLogs();
                } else {
                    setIsAuthorized(false);
                }
            } catch (err) {
                console.error('Error verifying admin authorization:', err);
                setIsAuthorized(false);
            } finally {
                setCheckingAuth(false);
            }
        };

        verifyAdmin();
    }, []);

    const toggleDocSelection = (id: string) => {
        setSelectedDocs(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const exportToCSV = (data: any[], fileName: string) => {
        if (!data || !data.length) {
            alert('No hay datos disponibles para exportar.');
            return;
        }
        
        // Cabeceras
        const headers = Object.keys(data[0]).join(';');
        const rows = data.map(row => 
            Object.values(row)
                .map(value => `"${String(value).replace(/"/g, '""')}"`)
                .join(';')
        );
        
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join('\r\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${fileName}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadSelection = async () => {
        if (selectedDocs.length === 0) return;
        try {
            const numericIds = selectedDocs.map(Number);
            const { data, error } = await supabase
                .from('documents')
                .select('id, name, file_link, status')
                .in('id', numericIds);

            if (error) throw error;
            if (!data || data.length === 0) return;

            for (const doc of data) {
                if (!doc.file_link) continue;
                let url = doc.file_link;

                if (!url.startsWith('http')) {
                    const { data: publicUrl } = supabase.storage
                        .from('raw-reports')
                        .getPublicUrl(doc.file_link);
                    url = publicUrl.publicUrl;
                }

                window.open(url, '_blank');
            }
        } catch (err: any) {
            alert('Error al descargar la selección: ' + err.message);
        }
    };

    const filteredUsers = userTrace.filter(r => 
        r.user.toLowerCase().includes(searchUser.toLowerCase()) ||
        r.action.toLowerCase().includes(searchUser.toLowerCase()) ||
        r.module.toLowerCase().includes(searchUser.toLowerCase())
    );

    const filteredDocs = docTrace.filter(r => 
        r.name.toLowerCase().includes(searchDoc.toLowerCase()) ||
        r.action.toLowerCase().includes(searchDoc.toLowerCase()) ||
        r.user.toLowerCase().includes(searchDoc.toLowerCase())
    );

    if (checkingAuth) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: 'var(--text-secondary)' }}>
                <div style={{ width: '2rem', height: '2rem', border: '3px solid rgba(212,160,23,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
                <p style={{ fontSize: '0.875rem' }}>Verificando credenciales...</p>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1.5rem', textAlign: 'center', padding: '2rem' }}>
                <div style={{ padding: '1.5rem', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                    <Shield size={48} />
                </div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>Acceso Restringido</h1>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', fontSize: '0.95rem', lineHeight: 1.6 }}>
                    Esta sección de auditoría es de uso exclusivo para Administradores de Paltarumi SAC. Si necesitas privilegios adicionales, solicita la aprobación de gerencia.
                </p>
                <button 
                    onClick={() => router.push('/dashboard')}
                    style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '0.75rem 2rem', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 600, transition: 'all 0.2s' }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                    Regresar al Inicio
                </button>
            </main>
        );
    }

    const UserTraceView = () => (
        <div className={styles.tableSection}>
            <div className={styles.tableToolbar}>
                <div className={styles.searchBox}>
                    <Search size={18} color="var(--text-secondary)" />
                    <input 
                        type="text" 
                        placeholder="Buscar actividad de usuario..." 
                        value={searchUser}
                        onChange={(e) => setSearchUser(e.target.value)}
                    />
                </div>
                <div className={styles.filterGroup}>
                    <button className={styles.actionBtn} onClick={() => exportToCSV(filteredUsers, 'Auditoria_Usuarios')}>
                        <FileSpreadsheet size={16} /> Exportar CSV
                    </button>
                </div>
            </div>
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Usuario</th>
                            <th>Acción</th>
                            <th>Módulo</th>
                            <th>Fecha/Hora</th>
                            <th>Identificador / Email</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    No se encontraron registros de usuarios.
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map(row => (
                                <tr key={row.id}>
                                    <td style={{ fontWeight: 500 }}><User size={14} style={{ display: 'inline', marginRight: '8px' }} /> {row.user}</td>
                                    <td>{row.action}</td>
                                    <td>{row.module}</td>
                                    <td>{row.date}</td>
                                    <td><code>{row.ip}</code></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const DocTraceView = () => (
        <div className={styles.tableSection}>
            <div className={styles.tableToolbar}>
                <div className={styles.searchBox}>
                    <Search size={18} color="var(--text-secondary)" />
                    <input 
                        type="text" 
                        placeholder="Buscar trazabilidad de documento..." 
                        value={searchDoc}
                        onChange={(e) => setSearchDoc(e.target.value)}
                    />
                </div>
                <div className={styles.filterGroup}>
                    {selectedDocs.length > 0 && (
                        <button className={styles.actionBtn} style={{ backgroundColor: 'var(--primary)', color: 'white' }} onClick={handleDownloadSelection}>
                            <Download size={16} /> Descargar Selección ({selectedDocs.length})
                        </button>
                    )}
                    <button className={styles.actionBtn} onClick={() => exportToCSV(filteredDocs, 'Auditoria_Documentos')}>
                        <FileSpreadsheet size={16} /> Exportar CSV
                    </button>
                </div>
            </div>
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th style={{ width: '40px' }}></th>
                            <th>Documento</th>
                            <th>Evento</th>
                            <th>Responsable</th>
                            <th>Fecha/Hora</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDocs.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    No se encontraron registros de documentos.
                                </td>
                            </tr>
                        ) : (
                            filteredDocs.map(row => (
                                <tr key={row.id}>
                                    <td>
                                        <button 
                                            onClick={() => toggleDocSelection(row.id)}
                                            style={{ background: 'none', border: 'none', color: selectedDocs.includes(row.id) ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer' }}
                                        >
                                            {selectedDocs.includes(row.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                                        </button>
                                    </td>
                                    <td style={{ fontWeight: 500 }}>#{row.id} - {row.name}</td>
                                    <td>{row.action}</td>
                                    <td>{row.user}</td>
                                    <td>{row.date}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Auditoría General</h1>
                    <p className={styles.subtitle}>Supervisión de integridad de datos y actividad del sistema.</p>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
                    <div style={{ width: '2.5rem', height: '2.5rem', border: '3px solid rgba(212,160,23,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <style>{`
                        @keyframes spin { to { transform: rotate(360deg); } }
                    `}</style>
                </div>
            ) : (
                <Tabs tabs={[
                    { id: 'users', label: 'Trazabilidad de Usuarios', content: <UserTraceView /> },
                    { id: 'docs', label: 'Trazabilidad de Documentos', content: <DocTraceView /> }
                ]} />
            )}
        </div>
    );
}
