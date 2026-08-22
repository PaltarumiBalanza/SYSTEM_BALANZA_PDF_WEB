'use client';

import { useState, useRef, DragEvent, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Printer, CheckCircle, FileSignature, Paperclip, GripVertical, Save, AlertCircle, LayoutGrid, List, Edit, Loader2, BookOpen, Eye } from 'lucide-react';
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
    const [layoutMode, setLayoutMode] = useState<'grid' | 'list' | 'reader'>('grid');
    const [readerZoom, setReaderZoom] = useState(100); // Zoom porcentual (80% - 250%)
    const [pageSize, setPageSize] = useState<'sm' | 'md' | 'lg'>('md');
    const [userRole, setUserRole] = useState<string>('VIEWER'); // 'ADMIN', 'EDITOR' (Comercial), 'VIEWER' (Balanza)
    const [isDraggingFiles, setIsDraggingFiles] = useState(false);
    const [previewPageIndex, setPreviewPageIndex] = useState<number | null>(null); // 0-based index para vista hoja por hoja
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');
    const [renaming, setRenaming] = useState(false);

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
            .replace(/[^a-zA-Z0-9.\s-]/g, "_"); // Mantiene espacios y caracteres alfanuméricos válidos
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

                const isFinalState = docData.status === 'HECHO' || docData.status === 'CERRADO POR BALANZA';

                let originalBucket = 'raw-reports';
                let originalPath = docData.file_link;

                if (isFinalState) {
                    originalBucket = 'final-reports';
                    if (docData.file_link && docData.file_link.startsWith('http')) {
                        const parts = docData.file_link.split('/');
                        originalPath = parts[parts.length - 1];
                    }
                }

                const pdfjsLib = await import('pdfjs-dist');
                pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

                let loadedPages: PageItem[] = [];

                // CORRECCIÓN CRÍTICA: Para reportes finalizados (HECHO / CERRADO POR BALANZA),
                // cargar SIEMPRE el PDF compilado en final-reports, ignorando draft_operations.
                // Esto evita hojas repetidas y descuadres entre lo que se ve y lo que se descarga.
                if (!isFinalState && docData.draft_operations && Array.isArray(docData.draft_operations) && docData.draft_operations.length > 0) {
                    const draftOps = docData.draft_operations as any[];
                    const uniqueFiles = Array.from(new Set(draftOps.map(op => `${op.bucket}|${op.path}`)));
                    
                    const docMap: Record<string, any> = {};
                    await Promise.all(uniqueFiles.map(async (key) => {
                        const [bucket, path] = key.split('|');
                        let { data: fileData, error: fileError } = await supabase.storage
                            .from(bucket)
                            .download(path);
                        
                        // Fallback de autorecuperación: si falló en raw-reports porque el archivo fue renombrado, intentar con originalPath
                        if ((fileError || !fileData) && bucket === 'raw-reports' && originalPath && originalPath !== path) {
                            console.warn(`Archivo de borrador no encontrado en Storage (${path}). Reintentando con file_link actual (${originalPath})...`);
                            const retryRes = await supabase.storage
                                .from(originalBucket)
                                .download(originalPath);
                            if (!retryRes.error && retryRes.data) {
                                fileData = retryRes.data;
                                fileError = null;
                            }
                        }
                        
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
                        // Si era raw-reports y se usó fallback, asegurar que use el path vigente
                        const resolvedPath = (op.bucket === 'raw-reports' && originalPath) ? originalPath : op.path;
                        return {
                            id: idx + 1,
                            pageIndex: op.pageIndex,
                            source,
                            pdfDoc: pdfDoc || null,
                            bucket: op.bucket,
                            path: resolvedPath
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

            // Compilar el PDF físico consolidado con todas las hojas y anexos en final-reports
            const { data, error } = await supabase.functions.invoke('compile-and-sign-pdf', {
                body: {
                    documentId: Number(reportId),
                    supervisorId: user.id,
                    operations,
                    sign: signed,
                    targetStatus: 'CERRADO POR BALANZA'
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            alert('Reporte compilado y cerrado por Balanza exitosamente.');
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

    const performMarkObservado = async () => {
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
                .update({ status: 'OBSERVADO' })
                .eq('id', Number(reportId));

            if (error) throw error;

            await supabase.from('audit_documents').insert({
                document_id: Number(reportId),
                user_id: user.id,
                action: 'OBSERVED'
            });

            alert('Reporte marcado como Observado. El área correspondiente revisará las observaciones.');
            router.push('/dashboard');
        } catch (err: any) {
            alert('Error al marcar reporte como Observado: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleMarkObservado = () => {
        triggerConfirm({
            title: 'Marcar como Observado',
            message: '¿Está seguro de que desea marcar este reporte como OBSERVADO? Esto indica que existen observaciones pendientes de revisión por el área comercial o administración.',
            confirmText: 'Marcar como Observado',
            type: 'warning',
            onConfirm: performMarkObservado
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

    const handleRenameSave = async () => {
        if (!tempName.trim()) {
            alert('El nombre del archivo no puede estar vacío.');
            return;
        }

        const cleanName = sanitizeFileName(tempName.trim());
        if (!cleanName) {
            alert('El nombre del archivo no es válido.');
            return;
        }

        setRenaming(true);
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
                    documentId: parseInt(reportId || ''),
                    newName: cleanName
                })
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                throw new Error(result.error || 'Ocurrió un error al renombrar el archivo.');
            }

            setDocMetadata(prev => prev ? {
                ...prev,
                name: result.document.name,
                fileLink: result.file_link
            } : null);

            setIsEditingName(false);
            alert('Nombre de archivo actualizado con éxito.');
        } catch (err: any) {
            alert('Error al renombrar: ' + err.message);
        } finally {
            setRenaming(false);
        }
    };

    const handleDownloadClick = async () => {
        const isFinal = (docMetadata?.status === 'HECHO' || docMetadata?.status === 'CERRADO POR BALANZA') && docMetadata?.fileLink;
        if (isFinal) {
            try {
                let path = docMetadata!.fileLink;
                if (path.startsWith('http')) {
                    const parts = path.split('/');
                    path = parts[parts.length - 1];
                }

                const { data: fileData, error: downloadError } = await supabase.storage
                    .from('final-reports')
                    .download(path);

                if (downloadError || !fileData) {
                    window.open(docMetadata!.fileLink, '_blank');
                    return;
                }

                const blobUrl = URL.createObjectURL(fileData);
                const a = document.createElement('a');
                a.href = blobUrl;
                let downloadName = docMetadata!.name || 'reporte_final.pdf';
                if (!downloadName.toLowerCase().endsWith('.pdf')) {
                    downloadName += '.pdf';
                }
                a.download = downloadName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
            } catch (err) {
                window.open(docMetadata!.fileLink, '_blank');
            }
        } else {
            alert('El PDF final aún no ha sido compilado. Presione "Marcar como Completado" o "Cerrar por Balanza" para generarlo.');
        }
    };

    const handleDoubleClickPage = (idx: number) => {
        setPreviewPageIndex(idx);
    };

    const canvasWidth = pageSize === 'sm' ? 110 : pageSize === 'md' ? 180 : 300;
    const cardWidth = pageSize === 'sm' ? '120px' : pageSize === 'md' ? '190px' : '310px';

    const gridStyle = layoutMode === 'reader'
        ? {
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'center',
            gap: '1.5rem',
            width: '100%',
            padding: '1rem 0'
          }
        : layoutMode === 'list'
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
                    {isEditingName ? (
                        <div className={styles.headerTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                            <button className={styles.backBtn} onClick={() => router.push('/dashboard')} title="Volver al Dashboard" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <ArrowLeft size={20} />
                            </button>
                            <span style={{ whiteSpace: 'nowrap' }}>Reporte: </span>
                            <input
                                type="text"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                disabled={renaming}
                                style={{
                                    backgroundColor: 'var(--background)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-primary)',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.9rem',
                                    width: '250px',
                                    outline: 'none'
                                }}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameSave();
                                    if (e.key === 'Escape') setIsEditingName(false);
                                }}
                            />
                            <button 
                                onClick={handleRenameSave} 
                                disabled={renaming}
                                style={{
                                    padding: '0.25rem 0.5rem',
                                    backgroundColor: 'var(--primary)',
                                    color: 'var(--surface)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                }}
                            >
                                {renaming ? (
                                    <>
                                        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                        <span>Guardando...</span>
                                    </>
                                ) : 'Guardar'}
                            </button>
                            <button 
                                onClick={() => setIsEditingName(false)} 
                                disabled={renaming}
                                style={{
                                    padding: '0.25rem 0.5rem',
                                    backgroundColor: 'transparent',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem'
                                }}
                            >
                                Cancelar
                            </button>
                        </div>
                    ) : (
                        <div className={styles.headerTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button className={styles.backBtn} onClick={() => router.push('/dashboard')} title="Volver al Dashboard" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <ArrowLeft size={20} />
                            </button>
                            <span>Reporte: {docMetadata?.name || `Balanza #${reportId}`}</span>
                            {docMetadata && (
                                <button
                                    onClick={() => {
                                        setTempName(docMetadata.name.replace(/\.[^/.]+$/, ""));
                                        setIsEditingName(true);
                                    }}
                                    title="Renombrar Reporte"
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0.25rem'
                                    }}
                                >
                                    <Edit size={16} />
                                </button>
                            )}
                        </div>
                    )}
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

                    {layoutMode === 'reader' && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '1rem',
                            background: 'var(--surface)',
                            borderBottom: '1px solid var(--border)',
                            padding: '0.6rem 1rem',
                            position: 'sticky',
                            top: 0,
                            zIndex: 100,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                        }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Zoom de Lectura:
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button 
                                    onClick={() => setReaderZoom(prev => Math.max(80, prev - 20))}
                                    disabled={readerZoom <= 80}
                                    style={{
                                        background: 'var(--background)',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-primary)',
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        opacity: readerZoom <= 80 ? 0.4 : 1
                                    }}
                                >
                                    -
                                </button>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, minWidth: '45px', textAlign: 'center' }}>
                                    {readerZoom}%
                                </span>
                                <button 
                                    onClick={() => setReaderZoom(prev => Math.min(240, prev + 20))}
                                    disabled={readerZoom >= 240}
                                    style={{
                                        background: 'var(--background)',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-primary)',
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        opacity: readerZoom >= 240 ? 0.4 : 1
                                    }}
                                >
                                    +
                                </button>
                            </div>
                            <button
                                onClick={() => setReaderZoom(100)}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-secondary)',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Restablecer
                            </button>
                        </div>
                    )}

                    {layoutMode === 'reader' ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2rem',
                            width: '100%',
                            padding: '1.5rem 0'
                        }}>
                            {pages.map((p, idx) => {
                                const readerWidth = 720 * (readerZoom / 100);
                                return (
                                    <div
                                        key={p.id}
                                        style={{
                                            background: 'white',
                                            padding: '1.25rem',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border)',
                                            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            width: `${readerWidth}px`,
                                            gap: '0.75rem',
                                            position: 'relative',
                                            flexShrink: 0
                                        }}
                                    >
                                        {/* Page Number Badge */}
                                        <div style={{
                                            position: 'absolute',
                                            top: '1rem',
                                            left: '1rem',
                                            background: '#1e293b',
                                            color: '#f8fafc',
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            zIndex: 10
                                        }}>
                                            Pág. {idx + 1}
                                        </div>

                                        {/* Content page */}
                                        {p.pdfDoc ? (
                                            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
                                                <PdfPageCanvas
                                                    pdfDoc={p.pdfDoc}
                                                    pageIndex={p.pageIndex}
                                                    width={readerWidth}
                                                />
                                            </div>
                                        ) : (
                                            <div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                                Cargando página...
                                            </div>
                                        )}

                                        {/* Footer details */}
                                        <div style={{ color: '#475569', fontSize: '0.75rem', fontWeight: 600, borderTop: '1px solid #e2e8f0', width: '100%', paddingTop: '0.5rem', textAlign: 'center' }}>
                                            Hoja {idx + 1} de {pages.length} | Origen: {p.source === 'original' ? 'Reporte Original' : p.source}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
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
                    )}
                </div>
            </div>

            <div className={styles.rightPanel}>
                {/* Visual Options */}
                <div className={styles.panelSection}>
                    <div className={styles.panelTitle}>Opciones de Visualización</div>
                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                        <button 
                            onClick={() => setLayoutMode('grid')}
                            style={{ 
                                flex: 1, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '0.4rem', 
                                padding: '0.5rem 0.25rem', 
                                border: '1px solid var(--border)', 
                                borderRadius: '6px', 
                                background: layoutMode === 'grid' ? 'var(--primary-light)' : 'transparent',
                                color: layoutMode === 'grid' ? 'var(--primary)' : 'var(--text-secondary)',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                cursor: 'pointer'
                            }}
                        >
                            <LayoutGrid size={14} /> Cuadrícula
                        </button>
                        <button 
                            onClick={() => setLayoutMode('list')}
                            style={{ 
                                flex: 1, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '0.4rem', 
                                padding: '0.5rem 0.25rem', 
                                border: '1px solid var(--border)', 
                                borderRadius: '6px', 
                                background: layoutMode === 'list' ? 'var(--primary-light)' : 'transparent',
                                color: layoutMode === 'list' ? 'var(--primary)' : 'var(--text-secondary)',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                cursor: 'pointer'
                            }}
                        >
                            <List size={14} /> Lista
                        </button>
                        <button 
                            onClick={() => setLayoutMode('reader')}
                            style={{ 
                                flex: 1, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '0.4rem', 
                                padding: '0.5rem 0.25rem', 
                                border: '1px solid var(--border)', 
                                borderRadius: '6px', 
                                background: layoutMode === 'reader' ? 'var(--primary-light)' : 'transparent',
                                color: layoutMode === 'reader' ? 'var(--primary)' : 'var(--text-secondary)',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                cursor: 'pointer'
                            }}
                        >
                            <BookOpen size={14} /> Lector (Adobe)
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
                    <button className={styles.actionBtn} onClick={handleAttachClick} disabled={saving || docMetadata?.status === 'HECHO' || docMetadata?.status === 'CERRADO POR BALANZA'} style={{ cursor: (docMetadata?.status === 'HECHO' || docMetadata?.status === 'CERRADO POR BALANZA') ? 'not-allowed' : 'pointer', opacity: (docMetadata?.status === 'HECHO' || docMetadata?.status === 'CERRADO POR BALANZA') ? 0.4 : 1 }}>
                        <Paperclip size={18} /> Adjuntar PDF (Concatenar)
                    </button>
                    <button
                        className={`${styles.actionBtn} ${selected.length ? styles.danger : ''}`}
                        onClick={deleteSelected}
                        disabled={!selected.length || saving || docMetadata?.status === 'HECHO' || docMetadata?.status === 'CERRADO POR BALANZA'}
                        style={{ cursor: 'pointer' }}
                    >
                        <Trash2 size={18} /> Eliminar Seleccionadas ({selected.length})
                    </button>
                </div>

                <div className={styles.panelSection}>
                    <div className={styles.panelTitle}>Autorización</div>

                    {/* Banner de solo lectura para estados finales */}
                    {(docMetadata?.status === 'HECHO' || docMetadata?.status === 'CERRADO POR BALANZA') && (
                        <div style={{
                            padding: '0.75rem',
                            borderRadius: '8px',
                            backgroundColor: docMetadata.status === 'HECHO' ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.08)',
                            border: `1px solid ${docMetadata.status === 'HECHO' ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`,
                            color: docMetadata.status === 'HECHO' ? 'var(--status-success)' : '#3b82f6',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            <CheckCircle size={15} />
                            {docMetadata.status === 'HECHO' ? 'Reporte Completado — Solo lectura' : 'Cerrado por Balanza — Solo lectura'}
                        </div>
                    )}

                    {/* Acciones de Comercial / Admin — solo si NO está en estado final */}
                    {(userRole === 'ADMIN' || userRole === 'EDITOR' || userRole === 'SUPERVISOR') && docMetadata?.status !== 'HECHO' && docMetadata?.status !== 'CERRADO POR BALANZA' && (
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
                                <CheckCircle size={18} /> {saving ? 'Procesando...' : 'Marcar como Completado'}
                            </button>
                        </>
                    )}

                    {/* Acciones de Balanza — solo si NO está en estado final */}
                    {userRole === 'VIEWER' && docMetadata?.status !== 'HECHO' && docMetadata?.status !== 'CERRADO POR BALANZA' && (
                        <>
                            <button
                                className={styles.actionBtn}
                                onClick={handleCloseByBalanza}
                                disabled={saving || pages.length === 0}
                                style={{
                                    cursor: 'pointer',
                                    backgroundColor: '#3b82f6',
                                    borderColor: '#3b82f6',
                                    color: 'white'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor = '#2563eb';
                                    e.currentTarget.style.borderColor = '#2563eb';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor = '#3b82f6';
                                    e.currentTarget.style.borderColor = '#3b82f6';
                                }}
                            >
                                <FileSignature size={18} /> {saving ? 'Procesando...' : 'Cerrar por Balanza'}
                            </button>
                            {docMetadata?.status !== 'OBSERVADO' && (
                                <button
                                    className={styles.actionBtn}
                                    onClick={handleMarkObservado}
                                    disabled={saving}
                                    style={{
                                        marginTop: '0.5rem',
                                        cursor: 'pointer',
                                        backgroundColor: 'rgba(245,158,11,0.08)',
                                        borderColor: '#f59e0b',
                                        color: '#f59e0b'
                                    }}
                                >
                                    <Eye size={18} /> Marcar como Observado
                                </button>
                            )}
                        </>
                    )}

                    {/* Guardar Borrador — visible para todos excepto en estados finales */}
                    {docMetadata?.status !== 'HECHO' && docMetadata?.status !== 'CERRADO POR BALANZA' && (
                        <button
                            className={styles.actionBtn}
                            onClick={handleSaveDraft}
                            disabled={saving || pages.length === 0}
                            style={{ marginTop: '0.5rem', borderColor: 'var(--primary)', color: 'var(--primary)', cursor: 'pointer' }}
                        >
                            <Save size={18} /> Guardar Borrador
                        </button>
                    )}

                    {/* Marcar como Error — visible solo para Comercial/Admin, no Balanza, y no en estados finales */}
                    {userRole !== 'VIEWER' && docMetadata?.status !== 'ERROR' && docMetadata?.status !== 'HECHO' && docMetadata?.status !== 'CERRADO POR BALANZA' && (
                        <button
                            className={styles.actionBtn}
                            onClick={handleMarkError}
                            disabled={saving}
                            style={{ marginTop: '0.5rem', borderColor: 'var(--status-error)', color: 'var(--status-error)', cursor: 'pointer' }}
                        >
                            <AlertCircle size={18} /> Marcar como Error
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
