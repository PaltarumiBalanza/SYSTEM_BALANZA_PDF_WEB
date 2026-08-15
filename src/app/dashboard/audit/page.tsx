'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, Search, User, CheckSquare, Square, Shield, Loader2, Archive, BarChart3, MapPin, Building2, AlertTriangle, FileText, CheckCircle, AlertCircle, ClipboardCheck } from 'lucide-react';
import styles from '../dashboard.module.css';
import { Tabs } from '@/components/ui/Tabs';
import { supabase } from '@/lib/supabaseClient';
import JSZip from 'jszip';
import { Modal } from '@/components/ui/Modal';

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

    // Estados para Descarga Masiva (ZIP)
    const [bulkDocs, setBulkDocs] = useState<any[]>([]);
    const [selectedBulkIds, setSelectedBulkIds] = useState<number[]>([]);
    const [downloadingZip, setDownloadingZip] = useState(false);
    const [zipProgress, setZipProgress] = useState(0);
    const [zipMessage, setZipMessage] = useState('');
    const [bulkCompanyFilter, setBulkCompanyFilter] = useState('ALL');
    const [bulkStatusFilter, setBulkStatusFilter] = useState('ALL');
    const [bulkRegionFilter, setBulkRegionFilter] = useState('ALL');
    const [bulkSearch, setBulkSearch] = useState('');

    // Estados para Métricas
    const [metricsUsers, setMetricsUsers] = useState<any[]>([]);
    const [metricsDocs, setMetricsDocs] = useState<any[]>([]);
    const [metricsLoading, setMetricsLoading] = useState(false);

    // Filtros de fecha y modal de detalle para Métricas
    const [metricsStartDate, setMetricsStartDate] = useState('');
    const [metricsEndDate, setMetricsEndDate] = useState('');
    const [selectedMetricsUser, setSelectedMetricsUser] = useState<any | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<string>('');

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
                        name,
                        status,
                        file_link
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
                    ip: t.users?.email || 'N/A',
                    docId: t.document_id,
                    docName: t.documents?.name || 'Reporte Eliminado'
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
                    date: new Date(t.modification_date).toLocaleString('es-PE', { timeZone: 'America/Lima' }),
                    status: t.documents?.status || 'ELIMINADO',
                    fileLink: t.documents?.file_link || ''
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

    const fetchBulkDocs = async () => {
        try {
            const { data, error } = await supabase
                .from('documents')
                .select(`
                    id,
                    name,
                    status,
                    creation_date,
                    region,
                    company,
                    file_link,
                    users:users!user_id (first_name, last_name)
                `)
                .order('id', { ascending: false });

            if (error) throw error;
            setBulkDocs(data || []);
        } catch (err) {
            console.error('Error fetching bulk documents:', err);
        }
    };

    const fetchMetricsData = async () => {
        setMetricsLoading(true);
        try {
            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select(`
                    id,
                    first_name,
                    last_name,
                    email,
                    user_roles (
                        roles (
                            name
                        )
                    )
                `);

            if (usersError) throw usersError;

            const { data: docsData, error: docsError } = await supabase
                .from('documents')
                .select('id, user_id, encargado_cierre, status, company, region, name, creation_date');

            if (docsError) throw docsError;

            setMetricsUsers(usersData || []);
            setMetricsDocs(docsData || []);
        } catch (err) {
            console.error('Error fetching metrics data:', err);
        } finally {
            setMetricsLoading(false);
        }
    };

    const getFilteredBulkDocs = () => {
        return bulkDocs.filter(d => {
            // Si es rol Comercial (EDITOR), forzar que solo se muestren documentos en estado CERRADO o CERRADO POR BALANZA
            if (currentUserRole === 'EDITOR') {
                if (d.status !== 'CERRADO' && d.status !== 'CERRADO POR BALANZA') return false;
            }

            const matchesCompany = bulkCompanyFilter === 'ALL' || d.company === bulkCompanyFilter;
            const matchesStatus = bulkStatusFilter === 'ALL' || d.status === bulkStatusFilter;
            const matchesRegion = bulkRegionFilter === 'ALL' || d.region === bulkRegionFilter;
            
            const creatorFull = d.users ? `${d.users.first_name} ${d.users.last_name || ''}`.toLowerCase() : 'sistema';
            const query = bulkSearch.toLowerCase();
            const matchesSearch = query === '' || 
                                  d.name.toLowerCase().includes(query) || 
                                  creatorFull.includes(query) || 
                                  String(d.id).includes(query);

            return matchesCompany && matchesStatus && matchesRegion && matchesSearch;
        });
    };

    const getUniqueRegions = () => {
        const regions = bulkDocs.map(d => d.region || 'General').filter(Boolean);
        return Array.from(new Set(regions));
    };

    const downloadZip = async () => {
        const filtered = getFilteredBulkDocs();
        const selected = filtered.filter(d => selectedBulkIds.includes(d.id));
        
        if (selected.length === 0) {
            alert('Por favor, selecciona al menos un reporte para descargar.');
            return;
        }

        setDownloadingZip(true);
        setZipProgress(0);
        setZipMessage('Inicializando descarga de reportes...');

        try {
            const zip = new JSZip();
            let downloadedCount = 0;
            const batchSize = 5;

            for (let i = 0; i < selected.length; i += batchSize) {
                const batch = selected.slice(i, i + batchSize);
                await Promise.all(batch.map(async (doc) => {
                    try {
                        let bucket = 'raw-reports';
                        let path = doc.file_link;

                        if (doc.status === 'HECHO') {
                            bucket = 'final-reports';
                            if (doc.file_link && doc.file_link.startsWith('http')) {
                                const parts = doc.file_link.split('/');
                                path = parts[parts.length - 1];
                            }
                        }

                        if (!path) {
                            console.warn(`Documento ID ${doc.id} no tiene file_link válido.`);
                            return;
                        }

                        // Descargar usando el SDK de Supabase que incluye auth de manera nativa
                        const { data: fileData, error: fileError } = await supabase.storage
                            .from(bucket)
                            .download(path);

                        if (fileError) throw fileError;
                        if (!fileData) throw new Error('No se recibieron datos del archivo.');

                        const arrayBuffer = await fileData.arrayBuffer();

                        let filename = doc.name;
                        if (!filename.toLowerCase().endsWith('.pdf')) {
                            filename += '.pdf';
                        }

                        const zipFilename = `${doc.id}-${filename}`;
                        zip.file(zipFilename, arrayBuffer);
                    } catch (err) {
                        console.error(`Error descargando doc #${doc.id}:`, err);
                    } finally {
                        downloadedCount++;
                        const percent = Math.round((downloadedCount / selected.length) * 100);
                        setZipProgress(percent);
                        setZipMessage(`Descargando archivo ${downloadedCount} de ${selected.length}...`);
                    }
                }));
            }

            setZipMessage('Comprimiendo archivos en ZIP...');
            const content = await zip.generateAsync({ type: 'blob' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `Reportes_Balanza_Masivo_${Date.now()}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setZipMessage('¡Archivo ZIP descargado con éxito!');
        } catch (err: any) {
            alert('Error al empaquetar el ZIP: ' + err.message);
            setZipMessage('Error al generar el ZIP.');
        } finally {
            setTimeout(() => {
                setDownloadingZip(false);
                setZipProgress(0);
                setZipMessage('');
            }, 3000);
        }
    };

    const BulkDownloadView = () => {
        const filteredDocs = getFilteredBulkDocs();
        const regions = getUniqueRegions();
        const allSelected = filteredDocs.length > 0 && filteredDocs.every(d => selectedBulkIds.includes(d.id));

        const toggleSelectAll = () => {
            if (allSelected) {
                const filteredIds = filteredDocs.map(d => d.id);
                setSelectedBulkIds(prev => prev.filter(id => !filteredIds.includes(id)));
            } else {
                const filteredIds = filteredDocs.map(d => d.id);
                setSelectedBulkIds(prev => Array.from(new Set([...prev, ...filteredIds])));
            }
        };

        const toggleDocSelect = (id: number) => {
            setSelectedBulkIds(prev => 
                prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
            );
        };

        return (
            <div className={styles.tableSection}>
                {downloadingZip && (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        zIndex: 9999,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '1.5rem',
                        backdropFilter: 'blur(5px)'
                    }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: '6rem', height: '6rem', border: '5px solid rgba(212,160,23,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1.2s linear infinite' }} />
                            <div style={{ position: 'absolute', fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>
                                {zipProgress}%
                            </div>
                        </div>
                        <h2 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 600 }}>{zipMessage}</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Por favor espera, no cierres esta pestaña.</p>
                        <style>{`
                            @keyframes spin { to { transform: rotate(360deg); } }
                        `}</style>
                    </div>
                )}

                <div className={styles.tableToolbar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'stretch', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div className={styles.searchBox} style={{ width: '100%', maxWidth: '350px' }}>
                            <Search size={18} color="var(--text-secondary)" />
                            <input 
                                type="text" 
                                placeholder="Buscar por Nombre, Creador o ID..." 
                                value={bulkSearch}
                                onChange={(e) => setBulkSearch(e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            {selectedBulkIds.length > 0 && (
                                <button className={styles.actionBtn} style={{ backgroundColor: 'var(--primary)', color: 'var(--surface)', fontWeight: 600 }} onClick={downloadZip}>
                                    <Archive size={16} style={{ marginRight: '6px' }} />
                                    Descargar ZIP ({selectedBulkIds.filter(id => filteredDocs.some(d => d.id === id)).length})
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Empresa</label>
                            <select 
                                value={bulkCompanyFilter} 
                                onChange={(e) => setBulkCompanyFilter(e.target.value)}
                                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '0.4rem 0.8rem', borderRadius: '6px', outline: 'none', fontSize: '0.85rem' }}
                            >
                                <option value="ALL">Todas las Empresas</option>
                                <option value="PSAC">PSAC</option>
                                <option value="ECOGOLD">ECOGOLD</option>
                            </select>
                        </div>

                        {currentUserRole !== 'EDITOR' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Estado de Reporte</label>
                                <select 
                                    value={bulkStatusFilter} 
                                    onChange={(e) => setBulkStatusFilter(e.target.value)}
                                    style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '0.4rem 0.8rem', borderRadius: '6px', outline: 'none', fontSize: '0.85rem' }}
                                >
                                    <option value="ALL">Todos los Estados</option>
                                    <option value="PENDIENTE">Pendientes</option>
                                    <option value="CERRADO POR BALANZA">Cerrados Balanza</option>
                                    <option value="HECHO">Completados (Firmados)</option>
                                    <option value="ERROR">Con Errores</option>
                                </select>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Región</label>
                            <select 
                                value={bulkRegionFilter} 
                                onChange={(e) => setBulkRegionFilter(e.target.value)}
                                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '0.4rem 0.8rem', borderRadius: '6px', outline: 'none', fontSize: '0.85rem' }}
                            >
                                <option value="ALL">Todas las Regiones</option>
                                {regions.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>
                                    <button 
                                        onClick={toggleSelectAll}
                                        style={{ background: 'none', border: 'none', color: allSelected ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer' }}
                                    >
                                        {allSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                    </button>
                                </th>
                                <th>Reporte</th>
                                <th>Empresa</th>
                                <th>Estado</th>
                                <th>Región</th>
                                <th>Operador</th>
                                <th>Fecha Carga</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDocs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                        No se encontraron reportes con los filtros seleccionados.
                                    </td>
                                </tr>
                            ) : (
                                filteredDocs.map(row => {
                                    const isSelected = selectedBulkIds.includes(row.id);
                                    
                                    const rawDate = row.creation_date;
                                    let formattedDate = 'N/A';
                                    if (rawDate) {
                                        const hasTz = /[Zz]|[+-]\d{2}:?\d{2}$/.test(rawDate);
                                        const cleanStr = rawDate.includes('T') ? rawDate : rawDate.replace(' ', 'T');
                                        const finalStr = hasTz ? cleanStr : `${cleanStr}Z`;
                                        const parsed = new Date(finalStr);
                                        formattedDate = isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleString('es-PE', { 
                                            timeZone: 'America/Lima',
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric'
                                        });
                                    }

                                    return (
                                        <tr key={row.id}>
                                            <td>
                                                <button 
                                                    onClick={() => toggleDocSelect(row.id)}
                                                    style={{ background: 'none', border: 'none', color: isSelected ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer' }}
                                                >
                                                    {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                                </button>
                                            </td>
                                            <td style={{ fontWeight: 600, fontSize: '0.825rem' }}>#{row.id} - {row.name}</td>
                                            <td>
                                                <span style={{ 
                                                    padding: '0.2rem 0.5rem', 
                                                    borderRadius: '4px', 
                                                    fontSize: '0.75rem', 
                                                    fontWeight: 700, 
                                                    backgroundColor: row.company === 'ECOGOLD' ? 'rgba(212,160,23,0.1)' : 'rgba(16,185,129,0.1)', 
                                                    color: row.company === 'ECOGOLD' ? 'var(--primary)' : 'var(--status-success)' 
                                                }}>
                                                    {row.company}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`${styles.statusBadge} ${styles[row.status === 'PENDIENTE' ? 'pending' : row.status === 'HECHO' ? 'success' : (row.status === 'CERRADO' || row.status === 'CERRADO POR BALANZA') ? 'closed' : 'error']}`}>
                                                    {row.status === 'PENDIENTE' ? 'Pendiente' : row.status === 'HECHO' ? 'Hecho' : (row.status === 'CERRADO' || row.status === 'CERRADO POR BALANZA') ? 'Cerrado Balanza' : 'Error'}
                                                </span>
                                            </td>
                                            <td>{row.region || 'General'}</td>
                                            <td>{row.users ? `${row.users.first_name} ${row.users.last_name || ''}`.trim() : 'Sistema'}</td>
                                            <td>{formattedDate}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const MetricsDashboardView = () => {
        if (metricsLoading) {
            return (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
                    <div style={{ width: '2.5rem', height: '2.5rem', border: '3px solid rgba(212,160,23,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
            );
        }

        // Filtrar documentos por rango de fechas
        const filteredDocs = metricsDocs.filter(d => {
            if (!d.creation_date) return true;
            const docDate = d.creation_date.split('T')[0];
            if (metricsStartDate && docDate < metricsStartDate) return false;
            if (metricsEndDate && docDate > metricsEndDate) return false;
            return true;
        });

        const total = filteredDocs.length;
        const pending = filteredDocs.filter(d => d.status === 'PENDIENTE').length;
        const closed = filteredDocs.filter(d => d.status === 'CERRADO' || d.status === 'CERRADO POR BALANZA').length;
        const success = filteredDocs.filter(d => d.status === 'HECHO').length;
        const error = filteredDocs.filter(d => d.status === 'ERROR').length;

        const psacCount = filteredDocs.filter(d => d.company === 'PSAC').length;
        const ecogoldCount = filteredDocs.filter(d => d.company === 'ECOGOLD').length;

        const regionMap: Record<string, number> = {};
        filteredDocs.forEach(d => {
            const reg = d.region || 'General';
            regionMap[reg] = (regionMap[reg] || 0) + 1;
        });
        const sortedRegions = Object.entries(regionMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        const userProductivity = metricsUsers.map(user => {
            const name = `${user.first_name} ${user.last_name || ''}`.trim();
            const rawRole = user.user_roles?.[0]?.roles?.name || 'VIEWER';
            const roleName = rawRole === 'ADMIN' ? 'Administrador' : rawRole === 'EDITOR' ? 'Supervisor' : 'Operador';
            
            const created = filteredDocs.filter(d => d.user_id === user.id).length;
            const closed = filteredDocs.filter(d => d.encargado_cierre === user.id).length;

            return {
                id: user.id,
                name,
                email: user.email,
                role: roleName,
                created,
                closed
            };
        }).sort((a, b) => b.closed - a.closed || b.created - a.created);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Filtro de Fechas */}
                <div className={styles.tableToolbar} style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BarChart3 size={20} color="var(--primary)" />
                        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Rango de Fechas para Métricas</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Desde:</label>
                            <input 
                                type="date" 
                                value={metricsStartDate} 
                                onChange={(e) => setMetricsStartDate(e.target.value)}
                                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '0.4rem 0.8rem', borderRadius: '6px', outline: 'none', fontSize: '0.85rem' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Hasta:</label>
                            <input 
                                type="date" 
                                value={metricsEndDate} 
                                onChange={(e) => setMetricsEndDate(e.target.value)}
                                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '0.4rem 0.8rem', borderRadius: '6px', outline: 'none', fontSize: '0.85rem' }}
                            />
                        </div>
                        {(metricsStartDate || metricsEndDate) && (
                            <button 
                                onClick={() => {
                                    setMetricsStartDate('');
                                    setMetricsEndDate('');
                                }}
                                style={{
                                    backgroundColor: 'transparent',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border)',
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 600
                                }}
                            >
                                Limpiar
                            </button>
                        )}
                    </div>
                </div>

                {/* KPIs Cards */}
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <div className={`${styles.statIcon}`} style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}>
                            <FileText size={24} />
                        </div>
                        <div className={styles.statInfo}>
                            <h3>{total}</h3>
                            <p>Total de Reportes</p>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={`${styles.statIcon} ${styles.pending}`}>
                            <AlertCircle size={24} />
                        </div>
                        <div className={styles.statInfo}>
                            <h3>{pending}</h3>
                            <p>En Edición (Pendientes)</p>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={`${styles.statIcon} ${styles.closed}`}>
                            <ClipboardCheck size={24} />
                        </div>
                        <div className={styles.statInfo}>
                            <h3>{closed}</h3>
                            <p>Cerrados Balanza</p>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={`${styles.statIcon} ${styles.success}`}>
                            <CheckCircle size={24} />
                        </div>
                        <div className={styles.statInfo}>
                            <h3>{success}</h3>
                            <p>Completados (Firmados)</p>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={`${styles.statIcon} ${styles.error}`}>
                            <AlertTriangle size={24} />
                        </div>
                        <div className={styles.statInfo}>
                            <h3>{error}</h3>
                            <p>Con Errores</p>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
                    <div className={styles.tableSection} style={{ gridColumn: 'span 2' }}>
                        <div className={styles.tableToolbar}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Desempeño y Cierre de Reportes por Usuario</h2>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Usuario</th>
                                        <th>Rol</th>
                                        <th style={{ textAlign: 'center' }}>Reportes Subidos</th>
                                        <th style={{ textAlign: 'center' }}>Reportes Firmados (Cierre)</th>
                                        <th style={{ textAlign: 'center' }}>Detalles</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {userProductivity.map(u => (
                                        <tr key={u.id}>
                                            <td style={{ fontWeight: 500 }}>
                                                <div>{u.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.email}</div>
                                            </td>
                                            <td>
                                                <span style={{ 
                                                    padding: '0.15rem 0.5rem', 
                                                    borderRadius: '4px', 
                                                    fontSize: '0.75rem', 
                                                    fontWeight: 600, 
                                                    backgroundColor: u.role === 'Administrador' ? 'rgba(239,68,68,0.1)' : u.role === 'Supervisor' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.05)',
                                                    color: u.role === 'Administrador' ? '#ef4444' : u.role === 'Supervisor' ? '#3b82f6' : 'var(--text-secondary)'
                                                }}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{u.created}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, color: u.closed > 0 ? 'var(--status-success)' : 'inherit' }}>{u.closed}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button
                                                    onClick={() => {
                                                        setSelectedMetricsUser(u);
                                                        setShowDetailsModal(true);
                                                    }}
                                                    className={styles.traceBtn}
                                                    title="Ver Detalles"
                                                    style={{ padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                                >
                                                    <Search size={14} />
                                                    <span>Ver</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className={styles.tableSection}>
                            <div className={styles.tableToolbar}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Distribución por Empresa</h2>
                            </div>
                            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                        <span style={{ fontWeight: 600 }}>Paltarumi SAC (PSAC)</span>
                                        <span>{psacCount} reportes ({total > 0 ? Math.round((psacCount / total) * 100) : 0}%)</span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${total > 0 ? (psacCount / total) * 100 : 0}%`, height: '100%', backgroundColor: 'var(--status-success)' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                        <span style={{ fontWeight: 600 }}>ECOGOLD</span>
                                        <span>{ecogoldCount} reportes ({total > 0 ? Math.round((ecogoldCount / total) * 100) : 0}%)</span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${total > 0 ? (ecogoldCount / total) * 100 : 0}%`, height: '100%', backgroundColor: 'var(--primary)' }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.tableSection}>
                            <div className={styles.tableToolbar}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Distribución por Región</h2>
                            </div>
                            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className={styles.tableWrapper} style={{ border: 'none', padding: 0 }}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>Región</th>
                                                <th style={{ textAlign: 'right' }}>Cantidad</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedRegions.length === 0 ? (
                                                <tr>
                                                    <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No hay datos de regiones.</td>
                                                </tr>
                                            ) : (
                                                sortedRegions.map(r => (
                                                    <tr key={r.name}>
                                                        <td style={{ fontWeight: 500 }}><MapPin size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--primary)' }} /> {r.name}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.count}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const MetricsUserDetailsModal = () => {
        if (!selectedMetricsUser) return null;

        const uploadedDocs = metricsDocs.filter(d => d.user_id === selectedMetricsUser.id).filter(d => {
            if (!d.creation_date) return true;
            const docDate = d.creation_date.split('T')[0];
            if (metricsStartDate && docDate < metricsStartDate) return false;
            if (metricsEndDate && docDate > metricsEndDate) return false;
            return true;
        });

        const signedDocs = metricsDocs.filter(d => d.encargado_cierre === selectedMetricsUser.id).filter(d => {
            if (!d.creation_date) return true;
            const docDate = d.creation_date.split('T')[0];
            if (metricsStartDate && docDate < metricsStartDate) return false;
            if (metricsEndDate && docDate > metricsEndDate) return false;
            return true;
        });

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: '400px', maxWidth: '600px', padding: '0.5rem 0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Correo Electrónico: <code>{selectedMetricsUser.email}</code></span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rol del Sistema: <strong>{selectedMetricsUser.role}</strong></span>
                </div>
                
                <Tabs tabs={[
                    { 
                        id: 'uploaded', 
                        label: `Subidos (${uploadedDocs.length})`, 
                        content: (
                            <div className={styles.tableWrapper} style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '0.5rem' }}>
                                <table className={styles.table} style={{ fontSize: '0.8rem' }}>
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Reporte</th>
                                            <th>Empresa</th>
                                            <th>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {uploadedDocs.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No hay reportes subidos en este rango.</td>
                                            </tr>
                                        ) : (
                                            uploadedDocs.map(doc => (
                                                <tr key={doc.id}>
                                                    <td>#{doc.id}</td>
                                                    <td style={{ fontWeight: 600 }}>
                                                        <a href={`/editor/${doc.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                                                            {doc.name}
                                                        </a>
                                                    </td>
                                                    <td>{doc.company}</td>
                                                    <td>
                                                        <span className={`${styles.statusBadge} ${styles[doc.status === 'PENDIENTE' ? 'pending' : doc.status === 'HECHO' ? 'success' : (doc.status === 'CERRADO' || doc.status === 'CERRADO POR BALANZA') ? 'closed' : 'error']}`}>
                                                            {doc.status === 'PENDIENTE' ? 'Pendiente' : doc.status === 'HECHO' ? 'Hecho' : (doc.status === 'CERRADO' || doc.status === 'CERRADO POR BALANZA') ? 'Cerrado Balanza' : 'Error'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )
                    },
                    { 
                        id: 'signed', 
                        label: `Firmados (${signedDocs.length})`, 
                        content: (
                            <div className={styles.tableWrapper} style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '0.5rem' }}>
                                <table className={styles.table} style={{ fontSize: '0.8rem' }}>
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Reporte</th>
                                            <th>Empresa</th>
                                            <th>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {signedDocs.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No hay reportes firmados en este rango.</td>
                                            </tr>
                                        ) : (
                                            signedDocs.map(doc => (
                                                <tr key={doc.id}>
                                                    <td>#{doc.id}</td>
                                                    <td style={{ fontWeight: 600 }}>
                                                        <a href={`/editor/${doc.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                                                            {doc.name}
                                                        </a>
                                                    </td>
                                                    <td>{doc.company}</td>
                                                    <td>
                                                        <span className={`${styles.statusBadge} ${styles[doc.status === 'PENDIENTE' ? 'pending' : doc.status === 'HECHO' ? 'success' : (doc.status === 'CERRADO' || doc.status === 'CERRADO POR BALANZA') ? 'closed' : 'error']}`}>
                                                            {doc.status === 'PENDIENTE' ? 'Pendiente' : doc.status === 'HECHO' ? 'Hecho' : (doc.status === 'CERRADO' || doc.status === 'CERRADO POR BALANZA') ? 'Cerrado Balanza' : 'Error'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )
                    }
                ]} />
            </div>
        );
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

                if (!error && (data?.roles?.name === 'ADMIN' || data?.roles?.name === 'EDITOR')) {
                    setIsAuthorized(true);
                    setCurrentUserRole(data.roles.name);
                    await fetchAuditLogs();
                    await fetchBulkDocs();
                    await fetchMetricsData();
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

            let downloadedAny = false;
            for (const doc of data) {
                if (currentUserRole === 'EDITOR' && doc.status !== 'CERRADO' && doc.status !== 'CERRADO POR BALANZA') {
                    console.warn(`Descarga bloqueada para el reporte #${doc.id} por no estar en estado Cerrado por Balanza.`);
                    continue;
                }
                if (!doc.file_link) continue;
                let url = doc.file_link;

                if (!url.startsWith('http')) {
                    const { data: publicUrl } = supabase.storage
                        .from('raw-reports')
                        .getPublicUrl(doc.file_link);
                    url = publicUrl.publicUrl;
                }

                window.open(url, '_blank');
                downloadedAny = true;
            }

            if (!downloadedAny && currentUserRole === 'EDITOR') {
                alert('No se descargaron archivos. El rol Comercial solo tiene autorización para descargar reportes en estado "Cerrado por balanza".');
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
                            <th>Reporte Afectado</th>
                            <th>Fecha/Hora</th>
                            <th>Identificador / Email</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    No se encontraron registros de usuarios.
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map(row => (
                                <tr key={row.id}>
                                    <td style={{ fontWeight: 500 }}><User size={14} style={{ display: 'inline', marginRight: '8px' }} /> {row.user}</td>
                                    <td>{row.action}</td>
                                    <td>{row.module}</td>
                                    <td style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                                        {row.docId ? (
                                            <a href={`/editor/${row.docId}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                                                #{row.docId} - {row.docName}
                                            </a>
                                        ) : (
                                            'N/A'
                                        )}
                                    </td>
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

    const DocTraceView = () => {
        const displayDocs = currentUserRole === 'EDITOR'
            ? filteredDocs.filter(d => d.status === 'CERRADO' || d.status === 'CERRADO POR BALANZA')
            : filteredDocs;

        return (
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
                        <button className={styles.actionBtn} onClick={() => exportToCSV(displayDocs, 'Auditoria_Documentos')}>
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
                            {displayDocs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        No se encontraron registros de documentos.
                                    </td>
                                </tr>
                            ) : (
                                displayDocs.map(row => (
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
    };

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
                <Tabs tabs={
                    currentUserRole === 'EDITOR' ? [
                        { id: 'descargas', label: 'Descarga Masiva', content: BulkDownloadView() }
                    ] : [
                        { id: 'users', label: 'Trazabilidad de Usuarios', content: UserTraceView() },
                        { id: 'docs', label: 'Trazabilidad de Documentos', content: DocTraceView() },
                        { id: 'descargas', label: 'Descarga Masiva', content: BulkDownloadView() },
                        { id: 'metricas', label: 'Métricas de Control', content: MetricsDashboardView() }
                    ]
                } />
            )}

            <Modal 
                isOpen={showDetailsModal} 
                onClose={() => {
                    setShowDetailsModal(false);
                    setSelectedMetricsUser(null);
                }}
                title={`Detalles de Actividad - ${selectedMetricsUser?.name || ''}`}
                icon={<User size={20} color="var(--primary)" />}
                size="lg"
            >
                {MetricsUserDetailsModal()}
            </Modal>
        </div>
    );
}
