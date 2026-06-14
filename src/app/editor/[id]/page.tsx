'use client';

import { useState, useRef, DragEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Printer, CheckCircle, FileSignature, Paperclip, GripVertical } from 'lucide-react';
import styles from './editor.module.css';
import { PdfPageCanvas } from '@/components/ui/PdfPageCanvas';

interface PageItem {
    id: number;
    pageIndex: number;   // 1-based page number inside the source PDF
    source: string;      // 'original' | filename of attached pdf
    pdfData: ArrayBuffer | null; // null = original placeholder
}

async function readPdfPages(file: File): Promise<number> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    return pdf.numPages;
}

export default function EditorPage() {
    const { id } = useParams();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // The initial "original" pages with no real PDF data (placeholders)
    const [pages, setPages] = useState<PageItem[]>([
        { id: 1, pageIndex: 1, source: 'original', pdfData: null },
        { id: 2, pageIndex: 2, source: 'original', pdfData: null },
        { id: 3, pageIndex: 3, source: 'original', pdfData: null },
        { id: 4, pageIndex: 4, source: 'original', pdfData: null },
    ]);
    // Store PDF ArrayBuffers keyed by filename (shared across pages of same file)
    const [pdfBuffers, setPdfBuffers] = useState<Record<string, ArrayBuffer>>({});

    const [selected, setSelected] = useState<number[]>([]);
    const [signed, setSigned] = useState(false);
    const [dragOverId, setDragOverId] = useState<number | null>(null);
    const dragItem = useRef<number | null>(null);

    const reportId = Array.isArray(id) ? id[0] : id;

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
            // Get real page count using pdfjs
            const numPages = await readPdfPages(file);
            const baseName = file.name;

            // Store buffer so PdfPageCanvas can reuse it
            setPdfBuffers(prev => ({ ...prev, [baseName]: buffer }));

            const maxId = pages.length > 0 ? Math.max(...pages.map(p => p.id)) : 0;
            const newPages: PageItem[] = Array.from({ length: numPages }, (_, i) => ({
                id: maxId + i + 1,
                pageIndex: i + 1,
                source: baseName,
                pdfData: buffer,
            }));

            setPages(prev => [...prev, ...newPages]);
        } catch (err) {
            console.error('Error reading PDF:', err);
        }

        e.target.value = '';
    };

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
                        Reporte de Balanza #{reportId}
                    </div>
                    <div className={styles.headerTitle} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Región: Lima | Estado: Pendiente
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
                    <button className={styles.actionBtn} onClick={handleAttachClick}>
                        <Paperclip size={18} /> Adjuntar PDF (Concatenar)
                    </button>
                    <button
                        className={`${styles.actionBtn} ${selected.length ? styles.danger : ''}`}
                        onClick={deleteSelected}
                        disabled={!selected.length}
                    >
                        <Trash2 size={18} /> Eliminar Seleccionadas ({selected.length})
                    </button>
                </div>

                <div className={styles.panelSection}>
                    <div className={styles.panelTitle}>Autorización</div>
                    <button className={styles.actionBtn} onClick={() => setSigned(true)} style={{ color: 'var(--status-success)', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                        <FileSignature size={18} /> Estampar Firma de Revisado
                    </button>
                    <button className={`${styles.actionBtn} ${styles.primary}`} onClick={() => router.push('/dashboard')}>
                        <CheckCircle size={18} /> Marcar como Finalizado
                    </button>
                </div>

                <div className={styles.panelSection}>
                    <div className={styles.panelTitle}>Exportar</div>
                    <button className={styles.actionBtn}>
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
