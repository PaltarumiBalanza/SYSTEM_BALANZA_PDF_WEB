'use client';

import React, { useState, useEffect } from 'react';
import { X, History, MessageSquare, User, Clock, AlertCircle } from 'lucide-react';
import styles from './Modal.module.css';
import { supabase } from '@/lib/supabaseClient';

interface ModalProps {
    title: string;
    icon: React.ReactNode;
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

export function Modal({ title, icon, isOpen, onClose, children }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div className={styles.backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>{icon} {title}</h2>
                    <button className={styles.closeBtn} onClick={onClose} title="Cerrar">
                        <X size={20} />
                    </button>
                </div>
                <div className={styles.body}>{children}</div>
            </div>
        </div>
    );
}

export function TraceabilityContent({ reportId }: { reportId: string | number }) {
    const [traceData, setTraceData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTraceability = async () => {
            if (!reportId || reportId === 'user-history') {
                // Datos de prueba para el historial de usuarios
                setTraceData([
                    { title: 'Inicio de sesión exitoso', time: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }), user: 'Sistema' },
                    { title: 'Cambio de estado: Activo', time: new Date(Date.now() - 3600000).toLocaleString('es-PE', { timeZone: 'America/Lima' }), user: 'Administrador' },
                ]);
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('audit_documents')
                    .select(`
                        id,
                        action,
                        modification_date,
                        users (
                            first_name,
                            last_name
                        )
                    `)
                    .eq('document_id', Number(reportId))
                    .order('modification_date', { ascending: true });

                if (error) throw error;

                const mapped = (data || []).map((t: any) => {
                    let title = 'Acción registrada';
                    if (t.action === 'CREATE') title = 'Reporte preliminar registrado';
                    if (t.action === 'CLOSE') title = 'Reporte consolidado y firmado (HECHO)';
                    if (t.action === 'UPDATE') title = 'Páginas modificadas en editor';
                    if (t.action === 'DELETE') title = 'Reporte eliminado';

                    const userFull = t.users
                        ? [t.users.first_name, t.users.last_name].filter(Boolean).join(' ')
                        : 'Sistema / Scraper';

                    return {
                        title,
                        time: new Date(t.modification_date).toLocaleString('es-PE', { timeZone: 'America/Lima' }),
                        user: userFull
                    };
                });

                setTraceData(mapped);
            } catch (err) {
                console.error('Error fetching traceability logs:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTraceability();
    }, [reportId]);

    if (loading) {
        return <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1rem', textAlign: 'center' }}>Cargando historial...</div>;
    }

    if (traceData.length === 0) {
        return <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1rem', textAlign: 'center' }}>No hay registros de trazabilidad para este reporte.</div>;
    }

    return (
        <div className={styles.traceList}>
            {traceData.map((item, idx) => (
                <div key={idx} className={styles.traceItem}>
                    <div className={styles.traceDot}></div>
                    <div className={styles.traceContent}>
                        <h4>{item.title}</h4>
                        <p>{item.user} • {item.time}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

export function CommentsContent({ reportId }: { reportId: string | number }) {
    const [commentsData, setCommentsData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchComments = async () => {
        if (!reportId) return;
        try {
            const { data, error } = await supabase
                .from('comments')
                .select(`
                    id,
                    comment,
                    creation_date,
                    users (
                        first_name,
                        last_name
                    )
                `)
                .eq('document_id', Number(reportId))
                .order('creation_date', { ascending: true });

            if (error) throw error;

            const mapped = (data || []).map((c: any) => {
                const userFull = c.users
                    ? [c.users.first_name, c.users.last_name].filter(Boolean).join(' ')
                    : 'Usuario';
                
                const initials = c.users
                    ? `${c.users.first_name?.charAt(0) || ''}${c.users.last_name?.charAt(0) || ''}`.toUpperCase()
                    : 'U';

                const date = new Date(c.creation_date);
                const formattedTime = date.toLocaleString('es-PE', {
                    timeZone: 'America/Lima',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                return {
                    id: c.id,
                    user: userFull,
                    avatar: initials || 'U',
                    comment: c.comment,
                    time: formattedTime
                };
            });

            setCommentsData(mapped);
        } catch (err) {
            console.error('Error fetching comments:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchComments();
    }, [reportId]);

    const handleAddComment = async () => {
        if (!newComment.trim() || !reportId) return;
        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert('Debe iniciar sesión para agregar comentarios.');
                return;
            }

            const { error } = await supabase
                .from('comments')
                .insert({
                    document_id: Number(reportId),
                    user_id: user.id,
                    comment: newComment.trim()
                });

            if (error) throw error;

            setNewComment('');
            await fetchComments();
        } catch (err: any) {
            alert('Error al publicar comentario: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1rem', textAlign: 'center' }}>Cargando comentarios...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.commentList}>
                {commentsData.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '1rem', textAlign: 'center', fontStyle: 'italic' }}>
                        No hay comentarios de retroalimentación aún en este reporte.
                    </div>
                ) : (
                    commentsData.map((item) => (
                        <div key={item.id} className={styles.commentItem}>
                            <div className={styles.commentAvatar}>{item.avatar}</div>
                            <div className={styles.commentBubble}>
                                <h4>{item.user}</h4>
                                <p>{item.comment}</p>
                                <div className={styles.commentTime}>
                                    <Clock size={10} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> 
                                    {item.time}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            <div className={styles.addCommentForm}>
                <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escriba un comentario sobre este reporte de balanzas..."
                    disabled={submitting}
                    className={styles.commentInput}
                />
                <button 
                    onClick={handleAddComment} 
                    disabled={submitting || !newComment.trim()}
                    className={styles.commentSubmitBtn}
                >
                    {submitting ? 'Enviando...' : 'Comentar'}
                </button>
            </div>
        </div>
    );
}

export function ConfirmModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    confirmText = 'Confirmar', 
    cancelText = 'Cancelar',
    type = 'danger'
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onConfirm: () => void; 
    title: string; 
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}) {
    if (!isOpen) return null;

    const confirmColor = type === 'danger' ? '#ef4444' : type === 'warning' ? '#f59e0b' : 'var(--primary)';

    return (
        <div className={styles.backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.modal} style={{ maxWidth: '400px' }}>
                <div className={styles.header}>
                    <h2><AlertCircle size={20} color={confirmColor} /> {title}</h2>
                    <button className={styles.closeBtn} onClick={onClose} title="Cerrar">
                        <X size={20} />
                    </button>
                </div>
                <div className={styles.body}>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</p>
                </div>
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button 
                        onClick={onClose}
                        style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                        {cancelText}
                    </button>
                    <button 
                        onClick={() => { onConfirm(); onClose(); }}
                        style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: 'none', backgroundColor: confirmColor, color: 'white', fontWeight: 600, cursor: 'pointer' }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
