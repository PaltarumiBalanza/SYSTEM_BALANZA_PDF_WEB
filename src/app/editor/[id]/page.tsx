'use client';

import { useState, useRef, DragEvent, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Printer, CheckCircle, FileSignature, Paperclip, GripVertical, Save, AlertCircle, LayoutGrid, List } from 'lucide-react';
import styles from './editor.module.css';
import { PdfPageCanvas } from '@/components/ui/PdfPageCanvas';
import { ConfirmModal } from '@/components/ui/Modal';
import { supabase } from '@/lib/supabaseClient';

interface PageItem {
    id: number;
    pageIndex: number;   // 1-based page number inside the source PDF
    source: string;      // 'original' | filename of attached pdf
    pdfDoc: any;         // Instancia del documento PDF de pdfjs
    bucket: string;       // Storage bucket ('raw-reports' o 'annex-attachments')
    path: string;         // File path inside the bucket
}

export default function EditorPage() {
    const { id } = useParams();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const reportId = Array.isArray(id) ? id[0] : id;

    const [pages, setPages] = useState<PageItem[]>([]);
    const [selected, setSelected] = useState<number[]>([]);
    const [signed, setSigned] = useState(false);
    const [dragOverId, setDragOverId] = useState<number | null>(null);
    const dragItem = useRef<number | null>(null);

    const [loadingPdf, setLoadingPdf] = useState(true);
    const [saving, setSaving] = useState(false);
    const [docMetadata, setDocMetadata] = useState<{ name: string; status: string; creatorName: string; fileLink: string } | null>(null);
    
    // Novedades de visualización, zoom, roles y lector hoja por hoja
    const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
    const [pageSize, setPageSize] = useState<'sm' | 'md' | 'lg'>('md');
    const [userRole, setUserRole] = useState<string>('VIEWER'); // 'ADMIN', 'EDITOR' (Comercial), 'VIEWER' (Balanza)
    const [isDraggingFiles, setIsDraggingFiles] = useState(false);
    const [previewPageIndex, setPreviewPageIndex] = useState<number | null>(null); // 0-based index para vista hoja por hoja

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText?: string;
        onConfirm: () => void;
        type?: 'danger' | 'warning' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });

    const triggerConfirm = (config: Omit<typeof confirmConfig, 'isOpen'>) => {
        setConfirmConfig({ ...config, isOpen: true });
    };

    // Sanitizador de nombres de archivos para evitar errores en las llaves del Storage de Supabase
    const sanitizeFileName = (fileName: string): string => {
        return fileName
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remueve acentos
            .replace(/[ñÑ]/g, "n")
            .replace(/[^a-zA-Z0-9.-]/g, "_"); // Reemplaza espacios y símbolos extraños por guiones bajos
    };

    useEffect(() => {
        const loadOriginalPdf = async () => {
            if (!reportId) return;
            setLoadingPdf(true);
            try {
                // 1. Validar el rol del usuario logueado
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: roleData } = await supabase
                        .from('user_roles')
                        .select('roles(name)')
                        .eq('user_id', user.id)
                        .single() as any;
                    
                    if (roleData?.roles?.name) {
                        setUserRole(roleData.roles.name);
                    }
                }

                // 2. Traer metadatos del documento
                const { data: docData, error: docError } = await supabase
                    .from('documents')
                    .select(`
                        name,
                        status,
                        file_link,
                        draft_operations,
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

                let originalBucket = 'raw-reports';
                let originalPath = docData.file_link;

                if (docData.status === 'HECHO') {
                    originalBucket = 'final-reports';
                    if (docData.file_link && docData.file_link.startsWith('http')) {
                        const parts = docData.file_link.split('/');
                        originalPath = parts[parts.length - 1];
                    }
                }

                const pdfjsLib = await import('pdfjs-dist');
                pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

                let loadedPages: PageItem[] = [];

                if (docData.draft_operations && Array.isArray(docData.draft_operations) && docData.draft_operations.length > 0) {
                    const draftOps = docData.draft_operations as any[];
                    const uniqueFiles = Array.from(new Set(draftOps.map(op => `${op.bucket}|${op.path}`)));
                    
                    const docMap: Record<string, any> = {};
                    await Promise.all(uniqueFiles.map(async (key) => {
                        const [bucket, path] = key.split('|');
                        const { data: fileData, error: fileError } = await supabase.storage
                            .from(bucket)
                            .download(path);
                        
                        if (!fileError && fileData) {
                            const buffer = await fileData.arrayBuffer();
                            const pdfDoc = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
                            docMap[key] = pdfDoc;
                        } else {
                            console.error(`Fallo al descargar ${key}:`, fileError);
                        }
                    }));

                    loadedPages = draftOps.map((op, idx) => {
                        const key = `${op.bucket}|${op.path}`;
                        const pdfDoc = docMap[key];
                        const source = op.bucket === 'raw-reports' ? 'original' : op.path.split('-').pop() || 'anexo.pdf';
                        return {
                            id: idx + 1,
                            pageIndex: op.pageIndex,
                            source,
                            pdfDoc: pdfDoc || null,
                            bucket: op.bucket,
                            path: op.path
                        };
                    });
                } else {
                    if (!originalPath) {
                        throw new Error('El reporte no tiene un archivo PDF asociado.');
                    }

                    const { data: fileData, error: fileError } = await supabase.storage
                        .from(originalBucket)
                        .download(originalPath);

                    if (fileError || !fileData) {
                        throw new Error(fileError?.message || 'Fallo al descargar el archivo PDF.');
                    }

                    const buffer = await fileData.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;

                    loadedPages = Array.from({ length: pdf.numPages }, (_, i) => ({
                        id: i + 1,
                        pageIndex: i + 1,
                        source: 'original',
                        pdfDoc: pdf,
                        bucket: originalBucket,
                        path: originalPath
                    }));
                }

                setPages(loadedPages);
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
        if (!selected.length) return;
        setPages(prev => prev.filter(p => !selected.includes(p.id)));
        setSelected([]);
    };

    // ---- Drag and drop reordering ----
    const onDragStart = (e: DragEvent, id: number) => {
        dragItem.current = id;
    };

    const onDragOver = (e: DragEvent, id: number) => {
        e.preventDefault();
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

    // ---- Attach real PDF helper ----
    const handleAttachClick = () => fileInputRef.current?.click();

    const processPdfFile = async (file: File) => {
        if (!file || !file.name.toLowerCase().endsWith('.pdf')) return;

        try {
            const buffer = await file.arrayBuffer();
            
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
            const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
            
            const baseName = file.name;
            const sanitizedName = sanitizeFileName(baseName);

            // Subir el anexo al bucket 'annex-attachments' en Supabase Storage usando clave sanitizada
            const annexPath = `${reportId}-annex-${Date.now()}-${sanitizedName}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('annex-attachments')
                .upload(annexPath, file, { contentType: 'application/pdf', upsert: true });

            if (uploadError) {
                throw new Error('Fallo al subir el archivo anexo a Storage: ' + uploadError.message);
            }

            setPages(prev => {
                const maxId = prev.length > 0 ? Math.max(...prev.map(p => p.id)) : 0;
                const newPages: PageItem[] = Array.from({ length: pdf.numPages }, (_, i) => ({
                    id: maxId + i + 1,
                    pageIndex: i + 1,
                    source: baseName, // Conservamos el nombre original legible para la interfaz
                    pdfDoc: pdf,
                    bucket: 'annex-attachments',
                    path: uploadData.path
                }));
                return [...prev, ...newPages];
            });
        } catch (err: any) {
            alert(`Error al procesar el archivo ${file.name}: ` + err.message);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        
        for (const file of files) {
            await processPdfFile(file);
        }
        e.target.value = '';
    };

    // ---- Drag and drop files from Windows Explorer ----
    const handleWorkspaceDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            setIsDraggingFiles(true);
        }
    };

    const handleWorkspaceDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFiles(false);
    };

    const handleWorkspaceDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleWorkspaceDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFiles(false);

        const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
        if (files.length === 0) return;

        for (const file of files) {
            await processPdfFile(file);
        }
    };

    // ---- Actions ----
    const performSaveAndCompile = async () => {
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

    const handleSaveAndCompile = () => {
        if (pages.length === 0) return;
        triggerConfirm({
            title: 'Marcar como Finalizado',
            message: '¿Estás seguro de que deseas finalizar este reporte? Esto compilará el archivo consolidado definitivo y lo marcará como completado (Hecho) en el panel general.',
            confirmText: 'Finalizar y Firmar',
            type: 'warning',
            onConfirm: performSaveAndCompile
        });
    };

    const performCloseByBalanza = async () => {
        if (pages.length === 0) return;
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert('No se detectó sesión activa de usuario.');
                router.push('/login');
                return;
            }

            const operations = pages.map(p => ({
                bucket: p.bucket,
                path: p.path,
                pageIndex: p.pageIndex
            }));

            // Actualizar status a 'CERRADO POR BALANZA' y guardar draft
            const { error } = await supabase
                .from('documents')
                .update({
                    status: 'CERRADO POR BALANZA',
                    draft_operations: operations
                })
                .eq('id', Number(reportId));

            if (error) throw error;

            await supabase.from('audit_documents').insert({
                document_id: Number(reportId),
                user_id: user.id,
                action: 'CLOSE' // Registrado como cierre de balanza
            });

            alert('Reporte cerrado por Balanza exitosamente.');
            router.push('/dashboard');
        } catch (err: any) {
            alert('Error al cerrar por Balanza: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCloseByBalanza = () => {
        if (pages.length === 0) return;
        triggerConfirm({
            title: 'Cerrar por Balanza',
            message: '¿Estás seguro de que deseas colocar la firma de revisado y marcar este reporte como CERRADO POR BALANZA?',
            confirmText: 'Cerrar por Balanza',
            type: 'info',
            onConfirm: performCloseByBalanza
        });
    };

    const performSaveDraft = async () => {
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

            const { error } = await supabase
                .from('documents')
                .update({
                    draft_operations: operations
                })
                .eq('id', Number(reportId));

            if (error) throw error;

            await supabase.from('audit_documents').insert({
                document_id: Number(reportId),
                user_id: user.id,
                action: 'UPDATE'
            });

            alert('Borrador guardado exitosamente.');
        } catch (err: any) {
            alert('Error al guardar borrador: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDraft = () => {
        if (pages.length === 0) return;
        triggerConfirm({
            title: 'Guardar Borrador',
            message: '¿Deseas guardar la ordenación y anexos actuales como un borrador de trabajo temporal?',
            confirmText: 'Guardar Borrador',
            type: 'info',
            onConfirm: performSaveDraft
        });
    };

    const performMarkError = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert('No se detectó sesión activa de usuario. Inicie sesión nuevamente.');
                router.push('/login');
                return;
            }

            const { error } = await supabase
                .from('documents')
                .update({ status: 'ERROR' })
                .eq('id', Number(reportId));

            if (error) throw error;

            await supabase.from('audit_documents').insert({
                document_id: Number(reportId),
                user_id: user.id,
                action: 'ERROR_MARKED'
            });

            alert('Reporte marcado con error exitosamente.');
            router.push('/dashboard');
        } catch (err: any) {
            alert('Error al marcar reporte con error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleMarkError = () => {
        triggerConfirm({
            title: 'Reportar Falla de Consistencia',
            message: '¿Está seguro de que desea invalidar este reporte y marcarlo en estado de ERROR para su corrección?',
            confirmText: 'Marcar con Error',
            type: 'danger',
            onConfirm: performMarkError
        });
    };

    const handleSignStamp = () => {
        triggerConfirm({
            title: 'Estampar Firma de Revisado',
            message: '¿Deseas habilitar la marca visual de "REVISADO" en la primera página de este reporte cuando sea compilado?',
            confirmText: 'Estampar',
            type: 'info',
            onConfirm: () => setSigned(true)
        });
    };

    const handleDownloadClick = () => {
        if (docMetadata?.status === 'HECHO' && docMetadata?.fileLink) {
            window.open(docMetadata.fileLink, '_blank');
        } else {
            alert('El PDF final aún no ha sido compilado. Presione "Marcar como Finalizado" para generarlo.');
        }
    };

    const handleDoubleClickPage = (idx: number) => {
        setPreviewPageIndex(idx);
    };

    const canvasWidth = pageSize === 'sm' ? 110 : pageSize === 'md' ? 180 : 300;
    const cardWidth = pageSize === 'sm' ? '120px' : pageSize === 'md' ? '190px' : '310px';

    const gridStyle = layoutMode === 'list'
        ? {
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'center',
            gap: '2rem',
            width: '100%'
          }
        : {
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${cardWidth}, 1fr))`,
            gap: '2rem',
            width: '100%',
            maxWidth: '900px'
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
                multiple
            />

            <div className={styles.leftPanel}>
                <div className={styles.pdfHeader}>
                    <div className={styles.headerTitle}>
                        <button className={styles.backBtn} onClick={() => router.push('/dashboard')} title="Volver al Dashboard" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                            <ArrowLeft size={20} />
                        </button>
                        Reporte: {docMetadata?.name || `Balanza #${reportId}`}
                    </div>
                    <div className={styles.headerTitle} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Operador: {docMetadata?.creatorName || 'Cargando...'} | Estado: {docMetadata?.status || 'Pendiente'}
                    </div>
                </div>

                <div 
                    className={styles.pdfScroll}
                    onDragEnter={handleWorkspaceDragEnter}
                    onDragOver={handleWorkspaceDragOver}
                    onDragLeave={handleWorkspaceDragLeave}
                    onDrop={handleWorkspaceDrop}
                    style={{ position: 'relative' }}
                >
                    {isDraggingFiles && (
                        <div style={{
                            position: 'absolute',
                            inset: '2rem',
                            border: '3px dashed var(--primary)',
                            borderRadius: 'var(--radius-lg)',
                            backgroundColor: 'rgba(212, 160, 23, 0.08)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '1rem',
                            zIndex: 100,
                            pointerEvents: 'none'
                        }}>
                            <Paperclip size={48} color="var(--primary)" style={{ animation: 'bounce 1s infinite' }} />
                            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Suelte los archivos aquí</span>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Se cargarán y anexarán automáticamente al final del reporte</span>
                        </div>
                    )}

                    <div style={gridStyle}>
                        {pages.map((p, idx) => (
                            <div
                                key={p.id}
                                className={`${styles.pageCard} ${selected.includes(p.id) ? styles.selected : ''} ${dragOverId === p.id ? styles.dragOver : ''}`}
                                style={{ width: cardWidth }}
                                draggable
                                onDragStart={(e) => onDragStart(e, p.id)}
                                onDragOver={(e) => onDragOver(e, p.id)}
                                onDrop={(e) => onDrop(e, p.id)}
                                onDragEnd={onDragEnd}
                                onClick={() => toggleSelect(p.id)}
                                onDoubleClick={() => handleDoubleClickPage(idx)}
                                title="Doble clic para ver en tamaño completo"
                            >
                                {/* Page number badge */}
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

                                {/* Actual PDF content */}
                                {p.pdfDoc ? (
                                    <div className={styles.canvasWrapper}>
                                        <PdfPageCanvas
                                            pdfDoc={p.pdfDoc}
                                            pageIndex={p.pageIndex}
                                            width={canvasWidth}
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
                {/* Visual Options */}
                <div className={styles.panelSection}>
                    <div className={styles.panelTitle}>Opciones de Visualización</div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <button 
                            onClick={() => setLayoutMode('grid')}
                            style={{ 
                                flex: 1, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '0.5rem', 
                                padding: '0.5rem', 
                                border: '1px solid var(--border)', 
                                borderRadius: '6px', 
                                background: layoutMode === 'grid' ? 'var(--primary-light)' : 'transparent',
                                color: layoutMode === 'grid' ? 'var(--primary)' : 'var(--text-secondary)',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            <LayoutGrid size={16} /> Cuadrícula
                        </button>
                        <button 
                            onClick={() => setLayoutMode('list')}
                            style={{ 
                                flex: 1, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '0.5rem', 
                                padding: '0.5rem', 
                                border: '1px solid var(--border)', 
                                borderRadius: '6px', 
                                background: layoutMode === 'list' ? 'var(--primary-light)' : 'transparent',
                                color: layoutMode === 'list' ? 'var(--primary)' : 'var(--text-secondary)',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            <List size={16} /> Lista
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {(['sm', 'md', 'lg'] as const).map(size => (
                            <button
                                key={size}
                                onClick={() => setPageSize(size)}
                                style={{
                                    flex: 1,
                                    padding: '0.4rem',
                                    fontSize: '0.75rem',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    background: pageSize === size ? 'var(--primary-light)' : 'transparent',
                                    color: pageSize === size ? 'var(--primary)' : 'var(--text-secondary)',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                {size === 'sm' ? 'Chico' : size === 'md' ? 'Mediano' : 'Grande'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={styles.panelSection}>
                    <div className={styles.panelTitle}>Acciones de Edición</div>
                    <button className={styles.actionBtn} onClick={handleAttachClick} disabled={saving} style={{ cursor: 'pointer' }}>
                        <Paperclip size={18} /> Adjuntar PDF (Concatenar)
                    </button>
                    <button
                        className={`${styles.actionBtn} ${selected.length ? styles.danger : ''}`}
                        onClick={deleteSelected}
                        disabled={!selected.length || saving}
                        style={{ cursor: 'pointer' }}
                    >
                        <Trash2 size={18} /> Eliminar Seleccionadas ({selected.length})
                    </button>
                </div>

                <div className={styles.panelSection}>
                    <div className={styles.panelTitle}>Autorización</div>
                    {/* Caso Comercial / Admin */}
                    {(userRole === 'ADMIN' || userRole === 'EDITOR' || userRole === 'SUPERVISOR') && (
                        <>
                            <button className={styles.actionBtn} onClick={handleSignStamp} style={{ color: 'var(--status-success)', borderColor: 'rgba(16, 185, 129, 0.4)', cursor: 'pointer' }} disabled={saving}>
                                <FileSignature size={18} /> Estampar Firma de Revisado
                            </button>
                            <button 
                                className={`${styles.actionBtn} ${styles.primary}`} 
                                onClick={handleSaveAndCompile}
                                disabled={saving || pages.length === 0}
                                style={{ cursor: 'pointer' }}
                            >
                                <CheckCircle size={18} /> {saving ? 'Procesando...' : 'Marcar como Finalizado'}
                            </button>
                        </>
                    )}
                    {/* Caso Balanza */}
                    {userRole === 'VIEWER' && (
                        <button 
                            className={`${styles.actionBtn} ${styles.primary}`}
                            onClick={handleCloseByBalanza}
                            disabled={saving || pages.length === 0}
                            style={{ cursor: 'pointer' }}
                        >
                            <FileSignature size={18} /> {saving ? 'Procesando...' : 'Estampar y Cerrar por Balanza'}
                        </button>
                    )}
                    <button 
                        className={styles.actionBtn} 
                        onClick={handleSaveDraft}
                        disabled={saving || pages.length === 0}
                        style={{ marginTop: '0.5rem', borderColor: 'var(--primary)', color: 'var(--primary)', cursor: 'pointer' }}
                    >
                        <Save size={18} /> Guardar Borrador
                    </button>
                    {docMetadata?.status !== 'ERROR' && (
                        <button 
                            className={styles.actionBtn} 
                            onClick={handleMarkError}
                            disabled={saving}
                            style={{ marginTop: '0.5rem', borderColor: 'var(--status-error)', color: 'var(--status-error)', cursor: 'pointer' }}
                        >
                            <AlertCircle size={18} /> Reportar Falla (Error)
                        </button>
                    )}
                </div>

                <div className={styles.panelSection}>
                    <div className={styles.panelTitle}>Exportar</div>
                    <button className={styles.actionBtn} onClick={handleDownloadClick} disabled={saving} style={{ cursor: 'pointer' }}>
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

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                confirmText={confirmConfig.confirmText}
                type={confirmConfig.type}
            />

            {/* Lightbox / Visualizador Hoja por Hoja Nítido */}
            {previewPageIndex !== null && (
                <div 
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 2000,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem'
                    }} 
                    onClick={() => setPreviewPageIndex(null)}
                >
                    <button 
                        onClick={() => setPreviewPageIndex(null)}
                        style={{
                            position: 'absolute',
                            top: '1.5rem',
                            right: '1.5rem',
                            background: 'rgba(255,255,255,0.15)',
                            border: 'none',
                            borderRadius: '50%',
                            color: 'white',
                            width: '40px',
                            height: '40px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}
                    >
                        ✕
                    </button>

                    <div 
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '2rem', 
                            width: '100%', 
                            maxWidth: '1200px', 
                            justifyContent: 'space-between' 
                        }} 
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Botón Anterior */}
                        <button 
                            disabled={previewPageIndex === 0}
                            onClick={() => setPreviewPageIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev)}
                            style={{
                                background: 'rgba(255,255,255,0.15)',
                                border: 'none',
                                borderRadius: '50%',
                                color: 'white',
                                width: '50px',
                                height: '50px',
                                cursor: previewPageIndex === 0 ? 'not-allowed' : 'pointer',
                                opacity: previewPageIndex === 0 ? 0.3 : 1,
                                fontSize: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.2s'
                            }}
                            onMouseOver={(e) => { if (previewPageIndex !== 0) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'; }}
                        >
                            ◀
                        </button>

                        {/* Visor del PDF Ampliado */}
                        <div style={{ 
                            background: 'var(--surface)', 
                            padding: '1.5rem', 
                            borderRadius: '12px', 
                            border: '1px solid var(--border)',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            maxWidth: '80%',
                            gap: '1.25rem'
                        }}>
                            <div style={{ width: '100%', height: '70vh', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '450px' }}>
                                <PdfPageCanvas 
                                    pdfDoc={pages[previewPageIndex].pdfDoc}
                                    pageIndex={pages[previewPageIndex].pageIndex}
                                    width={750} // Súper alta resolución + High DPI
                                />
                            </div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem', textAlign: 'center' }}>
                                Hoja {previewPageIndex + 1} de {pages.length} | Origen: {pages[previewPageIndex].source}
                            </div>
                        </div>

                        {/* Botón Siguiente */}
                        <button 
                            disabled={previewPageIndex === pages.length - 1}
                            onClick={() => setPreviewPageIndex(prev => prev !== null && prev < pages.length - 1 ? prev + 1 : prev)}
                            style={{
                                background: 'rgba(255,255,255,0.15)',
                                border: 'none',
                                borderRadius: '50%',
                                color: 'white',
                                width: '50px',
                                height: '50px',
                                cursor: previewPageIndex === pages.length - 1 ? 'not-allowed' : 'pointer',
                                opacity: previewPageIndex === pages.length - 1 ? 0.3 : 1,
                                fontSize: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.2s'
                            }}
                            onMouseOver={(e) => { if (previewPageIndex !== pages.length - 1) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'; }}
                        >
                            ▶
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
