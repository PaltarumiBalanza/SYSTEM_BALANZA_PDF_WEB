'use client';

import React from 'react';
import { X, History, MessageSquare, User, Clock, AlertCircle } from 'lucide-react';
import styles from './Modal.module.css';

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

export function TraceabilityContent({ reportId }: { reportId: string }) {
    const traceData = [
        { title: 'Generado por el Sistema', time: '2026-03-30 08:30 AM', user: 'System' },
        { title: 'Subida por Operador', time: '2026-03-30 09:12 AM', user: 'Juan Pérez' },
        { title: 'Pendiente de Aprobación', time: '2026-03-30 09:15 AM', user: 'Carlos Ruíz' },
        { title: 'Recepción Regional', time: '2026-03-30 11:20 AM', user: 'Elias Carmin' },
    ];

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

export function CommentsContent({ reportId }: { reportId: string }) {
    const commentsData = [
        { user: 'Juan Pérez', avatar: 'JP', comment: 'Se adjuntó el peso total de la balanza B-14.', time: 'Hace 2 horas' },
        { user: 'Carlos Ruíz', avatar: 'CR', comment: 'Revisando consistencia de datos según manual.', time: 'Hace 45 min' },
        { user: 'Ana Torres', avatar: 'AT', comment: 'Aprobado satisfactoriamente para la región sur.', time: 'Hace 10 min' },
    ];

    return (
        <div className={styles.commentList}>
            {commentsData.map((item, idx) => (
                <div key={idx} className={styles.commentItem}>
                    <div className={styles.commentAvatar}>{item.avatar}</div>
                    <div className={styles.commentBubble}>
                        <h4>{item.user}</h4>
                        <p>{item.comment}</p>
                        <div className={styles.commentTime}><Clock size={10} style={{ display: 'inline', marginRight: '4px' }} /> {item.time}</div>
                    </div>
                </div>
            ))}
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
