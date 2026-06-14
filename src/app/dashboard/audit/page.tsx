'use client';

import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Search, User, FileClock, CheckSquare, Square } from 'lucide-react';
import styles from '../dashboard.module.css';
import { Tabs } from '@/components/ui/Tabs';

const USER_TRACE_DATA = [
    { id: 1, user: 'Juan Pérez', action: 'Inicio de Sesión', module: 'Auth', date: '2026-03-31 08:30:12', ip: '192.168.1.45' },
    { id: 2, user: 'Carlos Ruíz', action: 'Subida de Documento', module: 'Reportes', date: '2026-03-31 09:12:05', ip: '192.168.1.12' },
    { id: 3, user: 'Elias Carmin', action: 'Aprobación de PDF', module: 'Editor', date: '2026-03-31 10:45:33', ip: '192.168.1.100' },
    { id: 4, user: 'Ana Torres', action: 'Descarga Masiva', module: 'Auditoría', date: '2026-03-31 11:20:00', ip: '192.168.1.56' },
];

const DOC_TRACE_DATA = [
    { id: '1024', name: 'BP_LIM_001.pdf', action: 'Modificación de Peso', user: 'Carlos Ruíz', date: '2026-03-31 09:12:05' },
    { id: '1023', name: 'BP_ANT_056.pdf', action: 'Aprobación Final', user: 'Elias Carmin', date: '2026-03-31 10:45:33' },
    { id: '1022', name: 'BP_CUS_012.pdf', action: 'Error de Lectura OCR', user: 'System', date: '2026-03-31 08:00:10' },
];

export default function AuditPage() {
    const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

    const toggleDocSelection = (id: string) => {
        setSelectedDocs(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const UserTraceView = () => (
        <div className={styles.tableSection}>
            <div className={styles.tableToolbar}>
                <div className={styles.searchBox}>
                    <Search size={18} color="var(--text-secondary)" />
                    <input type="text" placeholder="Buscar actividad de usuario..." />
                </div>
                <div className={styles.filterGroup}>
                    <button className={styles.actionBtn}><FileSpreadsheet size={16} /> Excel</button>
                    <button className={styles.actionBtn}><FileText size={16} /> CSV</button>
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
                            <th>Dirección IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {USER_TRACE_DATA.map(row => (
                            <tr key={row.id}>
                                <td style={{ fontWeight: 500 }}><User size={14} style={{ display: 'inline', marginRight: '8px' }} /> {row.user}</td>
                                <td>{row.action}</td>
                                <td>{row.module}</td>
                                <td>{row.date}</td>
                                <td><code>{row.ip}</code></td>
                            </tr>
                        ))}
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
                    <input type="text" placeholder="Buscar trazabilidad de documento..." />
                </div>
                <div className={styles.filterGroup}>
                    {selectedDocs.length > 0 && (
                        <button className={styles.actionBtn} style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                            <Download size={16} /> Descargar Selección ({selectedDocs.length})
                        </button>
                    )}
                    <button className={styles.actionBtn}><FileSpreadsheet size={16} /> Excel</button>
                    <button className={styles.actionBtn}><FileText size={16} /> CSV</button>
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
                        {DOC_TRACE_DATA.map(row => (
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
                        ))}
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

            <Tabs tabs={[
                { id: 'users', label: 'Trazabilidad de Usuarios', content: <UserTraceView /> },
                { id: 'docs', label: 'Trazabilidad de Documentos', content: <DocTraceView /> }
            ]} />
        </div>
    );
}
