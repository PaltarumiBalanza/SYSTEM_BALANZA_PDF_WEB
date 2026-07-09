'use client';

import { useState, useRef, DragEvent, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Printer, CheckCircle, FileSignature, Paperclip, GripVertical } from 'lucide-react';
import styles from './editor.module.css';
import { PdfPageCanvas } from '@/components/ui/PdfPageCanvas';
import { supabase } from '@/lib/supabaseClient';

interface PageItem {
    id: number;
    pageIndex: number;   // 1-based page number inside the source PDF
    source: string;      // 'original' | filename of attached pdf
    pdfData: ArrayBuffer | null;
    bucket: string;       // Storage bucket ('raw-reports' o 'annex-attachments')
    path: string;         // File path inside the bucket
}

async function readPdfPages(file: File): Promise<number> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    return pdf.numPages;
}

async function readPdfPagesFromBuffer(buffer: ArrayBuffer): Promise<number> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    return pdf.numPages;
}

export default function EditorPage() {
    const { id } = useParams();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const reportId = Array.isArray(id) ? id[0] : id;

    const [pages, setPages] = useState<PageItem[]>([]);
    const [pdfBuffers, setPdfBuffers] = useState<Record<string, ArrayBuffer>>({});

    const [selected, setSelected] = useState<number[]>([]);
    const [signed, setSigned] = useState(false);
    const [dragOverId, setDragOverId] = useState<number | null>(null);
    const dragItem = useRef<number | null>(null);

    const [loadingPdf, setLoadingPdf] = useState(true);
    const [saving, setSaving] = useState(false);
    const [docMetadata, setDocMetadata] = useState<{ name: string; status: string; creatorName: string; fileLink: string } | null>(null);

    useEffect(() => {
        const loadOriginalPdf = async () => {
            if (!reportId) return;
            setLoadingPdf(true);
            try {
                const { data: docData, error: docError } = await supabase
                    .from('documents')
                    .select(`
                        name,
                        status,
                        file_link,
                        users:users!user_id (
                            first_name,
                            last_name
                        )
                    `)
                    .eq('id', reportId)
                    .single() as any;

                if (docError || !docData) {
                    throw new Error(docError?.message || 'Reporte no encontrado en la base de datos.');
                }

                const creatorName = [docData.users?.first_name, docData.users?.last_name].filter(Boolean).join(' ') || 'Operador';
                setDocMetadata({
                    name: docData.name,
                    status: docData.status,
                    creatorName,
                    fileLink: docData.file_link
                });

                if (!docData.file_link) {
                    throw new Error('El reporte no tiene un archivo PDF asociado.');
                }

                const { data: fileData, error: fileError } = await supabase.storage
                    .from('raw-reports')
                    .download(docData.file_link);

                if (fileError || !fileData) {
                    throw new Error(fileError?.message || 'Fallo al descargar el archivo PDF original.');
                }

                const buffer = await fileData.arrayBuffer();
                const numPages = await readPdfPagesFromBuffer(buffer);

                setPdfBuffers({ original: buffer });

                const initialPages = Array.from({ length: numPages }, (_, i) => ({
                    id: i + 1,
                    pageIndex: i + 1,
                    source: 'original',
                    pdfData: buffer,
                    bucket: 'raw-reports',
                    path: docData.file_link
                }));

                setPages(initialPages);
            } catch (err: any) {
                alert('Error cargando reporte: ' + err.message);
                router.push('/dashboard');
            } finally {
                setLoadingPdf(false);
            }
        };

        loadOriginalPdf();
    }, [reportId]);

    const toggleSelect = (pageId: number) => {
        setSelected(prev => prev.includes(pageId) ? prev.filter(p => p !== pageId) : [...prev, pageId]);
    };

    const deleteSelected = () => {
        setPages(prev => prev.filter(p => !selected.includes(p.id)));
        setSelected([]);
    };

    // ---- Drag-to-reorder ----
    const onDragStart = (e: DragEvent, id: number) => {
        dragItem.current = id;
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (e: DragEvent, id: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverId(id);
    };

    const onDrop = (e: DragEvent, targetId: number) => {
        e.preventDefault();
        if (dragItem.current === null || dragItem.current === targetId) return;
        setPages(prev => {
            const arr = [...prev];
            const from = arr.findIndex(p => p.id === dragItem.current);
            const to = arr.findIndex(p => p.id === targetId);
            const [moved] = arr.splice(from, 1);
            arr.splice(to, 0, moved);
            return arr;
        });
        dragItem.current = null;
        setDragOverId(null);
    };

    const onDragEnd = () => setDragOverId(null);

    // ---- Attach real PDF ----
    const handleAttachClick = () => fileInputRef.current?.click();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !file.name.toLowerCase().endsWith('.pdf')) return;

        try {
            const buffer = await file.arrayBuffer();
            const numPages = await readPdfPages(file);
            const baseName = file.name;

            // Subir el anexo al bucket 'annex-attachments' en Supabase Storage
            const annexPath = `${reportId}-annex-${Date.now()}-${baseName}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('annex-attachments')
                .upload(annexPath, file, { contentType: 'application/pdf', upsert: true });

            if (uploadError) {
                throw new Error('Fallo al subir el archivo anexo a Storage: ' + uploadError.message);
            }

            setPdfBuffers(prev => ({ ...prev, [baseName]: buffer }));

            const maxId = pages.length > 0 ? Math.max(...pages.map(p => p.id)) : 0;
            const newPages: PageItem[] = Array.from({ length: numPages }, (_, i) => ({
                id: maxId + i + 1,
                pageIndex: i + 1,
                source: baseName,
                pdfData: buffer,
                bucket: 'annex-attachments',
                path: uploadData.path
            }));

            setPages(prev => [...prev, ...newPages]);
        } catch (err: any) {
            alert('Error al procesar el archivo anexo: ' + err.message);
        }
        e.target.value = '';
    };

    const handleSaveAndCompile = async () => {
        if (pages.length === 0) return;
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert('No se detectó sesión activa de usuario. Inicie sesión nuevamente.');
                router.push('/login');
                return;
            }

            const operations = pages.map(p => ({
                bucket: p.bucket,
                path: p.path,
                pageIndex: p.pageIndex
            }));

            const { data, error } = await supabase.functions.invoke('compile-and-sign-pdf', {
                body: {
                    documentId: Number(reportId),
                    supervisorId: user.id,
                    operations,
                    sign: signed
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            alert('Reporte compilado y firmado exitosamente.');
            router.push('/dashboard');
        } catch (err: any) {
            alert('Error al compilar y firmar el PDF: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadClick = () => {
        if (docMetadata?.status === 'HECHO' && docMetadata?.fileLink) {
            window.open(docMetadata.fileLink, '_blank');
        } else {
            alert('El PDF final aún no ha sido compilado. Presione "Marcar como Finalizado" para generarlo.');
        }
    };

    if (loadingPdf) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--background)', gap: '1rem', color: 'var(--text-secondary)' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', border: '3px solid rgba(212,160,23,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
                <p style={{ fontSize: '0.9rem' }}>Cargando reporte de balanzas desde Supabase Storage...</p>
            </div>
        );
    }

    return (
        <div className={styles.editorLayout}>
            <input
                type="file"
                accept="application/pdf"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            <div className={styles.leftPanel}>
                <div className={styles.pdfHeader}>
                    <div className={styles.headerTitle}>
                        <button className={styles.backBtn} onClick={() => router.push('/dashboard')} title="Volver al Dashboard">
                            <ArrowLeft size={20} />
                        </button>
                        Reporte: {docMetadata?.name || `Balanza #${reportId}`}
                    </div>
                    <div className={styles.headerTitle} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Operador: {docMetadata?.creatorName || 'Cargando...'} | Estado: {docMetadata?.status || 'Pendiente'}
                    </div>
                </div>

                <div className={styles.pdfScroll}>
                    <div className={styles.grid}>
                        {pages.map((p, idx) => (
                            <div
                                key={p.id}
                                className={`${styles.pageCard} ${selected.includes(p.id) ? styles.selected : ''} ${dragOverId === p.id ? styles.dragOver : ''}`}
                                draggable
                                onDragStart={(e) => onDragStart(e, p.id)}
                                onDragOver={(e) => onDragOver(e, p.id)}
                                onDrop={(e) => onDrop(e, p.id)}
                                onDragEnd={onDragEnd}
                                onClick={() => toggleSelect(p.id)}
                            >
                                {/* Page number badge (position in document) */}
                                <div className={styles.pageNumber}>{idx + 1}</div>

                                {/* Drag handle */}
                                <div className={styles.dragHandle}>
                                    <GripVertical size={18} />
                                </div>

                                {/* Selection checkbox */}
                                <input
                                    type="checkbox"
                                    className={styles.pageCheckbox}
                                    checked={selected.includes(p.id)}
                                    onChange={() => toggleSelect(p.id)}
                                    onClick={(e) => e.stopPropagation()}
                                />

                                {/* Actual PDF content or placeholder */}
                                {p.pdfData ? (
                                    <div className={styles.canvasWrapper}>
                                        <PdfPageCanvas
                                            pdfData={p.pdfData}
                                            pageIndex={p.pageIndex}
                                            width={180}
                                        />
                                    </div>
                                ) : (
                                    <div className={styles.pageContent}>
                                        <div className={styles.pageLabel}>Pág. {p.pageIndex}</div>
                                        <div className={styles.pageSource} style={{ color: '#64748b', background: 'none', fontSize: '0.7rem' }}>
                                            Documento original
                                        </div>
                                    </div>
                                )}

                                {/* Source badge for attached files */}
                                {p.source !== 'original' && (
                                    <div className={styles.pageSource}>
                                        <Paperclip size={11} />
                                        {p.source.length > 18 ? p.source.slice(0, 18) + '…' : p.source}
                                    </div>
                                )}

                                {/* Signature mark */}
                                {signed && idx === 0 && (
                                    <div className={styles.signatureMark}>
                                        <CheckCircle size={24} />
                                        <span>Revisado</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className={styles.rightPanel}>
                <div className={styles.panelSection}>
                    <div className={styles.panelTitle}>Acciones de Edición</div>
                    <button className={styles.actionBtn} onClick={handleAttachClick} disabled={saving}>
                        <Paperclip size={18} /> Adjuntar PDF (Concatenar)
                    </button>
                    <button
                        className={`${styles.actionBtn} ${selected.length ? styles.danger : ''}`}
                        onClick={deleteSelected}
                        disabled={!selected.length || saving}
                    >
                        <Trash2 size={18} /> Eliminar Seleccionadas ({selected.length})
                    </button>
                </div>

                <div className={styles.panelSection}>
                    <div className={styles.panelTitle}>Autorización</div>
                    <button className={styles.actionBtn} onClick={() => setSigned(true)} style={{ color: 'var(--status-success)', borderColor: 'rgba(16, 185, 129, 0.4)' }} disabled={saving}>
                        <FileSignature size={18} /> Estampar Firma de Revisado
                    </button>
                    <button 
                        className={`${styles.actionBtn} ${styles.primary}`} 
                        onClick={handleSaveAndCompile}
                        disabled={saving || pages.length === 0}
                    >
                        <CheckCircle size={18} /> {saving ? 'Procesando...' : 'Marcar como Finalizado'}
                    </button>
                </div>

                <div className={styles.panelSection}>
                    <div className={styles.panelTitle}>Exportar</div>
                    <button className={styles.actionBtn} onClick={handleDownloadClick} disabled={saving}>
                        <Printer size={18} /> Descargar PDF Completo
                    </button>
                </div>

                <div className={styles.panelSection}>
                    <div className={styles.panelTitle}>Resumen</div>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryRow}><span>Total de hojas</span><strong>{pages.length}</strong></div>
                        <div className={styles.summaryRow}><span>Originales</span><strong>{pages.filter(p => p.source === 'original').length}</strong></div>
                        <div className={styles.summaryRow}><span>Adjuntos</span><strong>{pages.filter(p => p.source !== 'original').length}</strong></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
