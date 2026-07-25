'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Trash2, Edit2, X, Briefcase, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import styles from '../dashboard.module.css';
import cStyles from './customers.module.css';
import { supabase } from '@/lib/supabaseClient';

interface CustomerItem {
    id: number;
    customer: string;
    ruc: string;
}

export default function CustomersPage() {
    const router = useRouter();
    const [customers, setCustomers] = useState<CustomerItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modales y formularios
    const [showModal, setShowModal] = useState<'none' | 'create' | 'edit'>('none');
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
    const [formData, setFormData] = useState({ customer: '', ruc: '' });
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Modal de confirmación de eliminación
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [customerToDelete, setCustomerToDelete] = useState<CustomerItem | null>(null);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('id', { ascending: false });

            if (error) throw error;
            setCustomers(data || []);
        } catch (err: any) {
            console.error('Error fetching customers:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    const openCreateModal = () => {
        setFormData({ customer: '', ruc: '' });
        setErrorMsg('');
        setShowModal('create');
    };

    const openEditModal = (customer: CustomerItem) => {
        setSelectedCustomer(customer);
        setFormData({ customer: customer.customer, ruc: customer.ruc });
        setErrorMsg('');
        setShowModal('edit');
    };

    const handleSaveCustomer = async () => {
        if (!formData.customer.trim() || !formData.ruc.trim()) {
            setErrorMsg('Todos los campos son obligatorios.');
            return;
        }

        // Validación simple de RUC (usualmente 11 dígitos en Perú)
        if (!/^\d+$/.test(formData.ruc.trim())) {
            setErrorMsg('El número de RUC debe contener solo dígitos.');
            return;
        }

        setSubmitting(true);
        setErrorMsg('');
        try {
            if (showModal === 'create') {
                const { data, error } = await supabase
                    .from('customers')
                    .insert({
                        customer: formData.customer.trim(),
                        ruc: formData.ruc.trim()
                    })
                    .select()
                    .single();

                if (error) {
                    if (error.code === '23505') {
                        throw new Error('El número de RUC ya se encuentra registrado.');
                    }
                    throw error;
                }

                setCustomers(prev => [data, ...prev]);
                setShowModal('none');
                alert('Cliente creado exitosamente.');
            } else if (showModal === 'edit' && selectedCustomer) {
                const { error } = await supabase
                    .from('customers')
                    .update({
                        customer: formData.customer.trim(),
                        ruc: formData.ruc.trim()
                    })
                    .eq('id', selectedCustomer.id);

                if (error) {
                    if (error.code === '23505') {
                        throw new Error('El número de RUC ya se encuentra registrado.');
                    }
                    throw error;
                }

                setCustomers(prev =>
                    prev.map(c => c.id === selectedCustomer.id 
                        ? { ...c, customer: formData.customer.trim(), ruc: formData.ruc.trim() } 
                        : c
                    )
                );
                setShowModal('none');
                alert('Cliente actualizado exitosamente.');
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error al guardar los datos del cliente.');
        } finally {
            setSubmitting(false);
        }
    };

    const triggerDeleteConfirm = (customer: CustomerItem) => {
        setCustomerToDelete(customer);
        setShowDeleteConfirm(true);
    };

    const handleDeleteCustomer = async () => {
        if (!customerToDelete) return;
        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('customers')
                .delete()
                .eq('id', customerToDelete.id);

            if (error) throw error;

            setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id));
            setShowDeleteConfirm(false);
            setCustomerToDelete(null);
            alert('Cliente eliminado exitosamente.');
        } catch (err: any) {
            alert('Error al eliminar cliente: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const filteredCustomers = customers.filter(c => {
        const query = searchQuery.toLowerCase();
        return c.customer.toLowerCase().includes(query) || c.ruc.includes(query);
    });

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Customers (Clientes)</h1>
                    <p className={styles.subtitle}>Gestión de cartera de clientes de balanza y números de RUC asociados.</p>
                </div>
                <button className={cStyles.newCustomerBtn} onClick={openCreateModal}>
                    <Plus size={18} /> Nuevo Cliente
                </button>
            </div>

            <div className={styles.tableSection}>
                <div className={styles.tableToolbar}>
                    <div className={styles.searchBox}>
                        <Search size={18} color="var(--text-secondary)" />
                        <input 
                            type="text" 
                            placeholder="Buscar por Razón Social o RUC..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
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
                                    <th>ID</th>
                                    <th>Razón Social / Cliente</th>
                                    <th>Número de RUC</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                                            No se encontraron clientes registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCustomers.map(row => (
                                        <tr key={row.id}>
                                            <td style={{ fontWeight: 600 }}>#{row.id}</td>
                                            <td style={{ fontWeight: 500, fontSize: '0.85rem' }}>{row.customer}</td>
                                            <td>{row.ruc}</td>
                                            <td className={styles.actionsCell}>
                                                <button className={styles.actionBtn} title="Editar Datos" onClick={() => openEditModal(row)}>
                                                    <Edit2 size={16} /> Editar
                                                </button>
                                                <button className={styles.deleteBtn} title="Eliminar Cliente" onClick={() => triggerDeleteConfirm(row)}>
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal de Creación / Edición */}
            {showModal !== 'none' && (
                <div className={cStyles.modalBackdrop} onClick={(e) => { if (e.target === e.currentTarget) setShowModal('none'); }}>
                    <div className={cStyles.customerModal}>
                        <div className={cStyles.modalHeader}>
                            <h2>
                                <Briefcase size={20} color="var(--primary)" />
                                {showModal === 'create' ? 'Agregar Nuevo Cliente' : 'Editar Cliente'}
                            </h2>
                            <button className={cStyles.modalClose} onClick={() => setShowModal('none')}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={cStyles.modalBody}>
                            <div className={cStyles.form}>
                                <div className={cStyles.formGroup}>
                                    <label><FileText size={14} /> Razón Social / Cliente</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ej: ORO NEGRO COMPAÑIA MINERA S.A.C." 
                                        value={formData.customer}
                                        onChange={(e) => setFormData(prev => ({ ...prev, customer: e.target.value }))}
                                        disabled={submitting}
                                    />
                                </div>
                                <div className={cStyles.formGroup}>
                                    <label><CheckCircle size={14} /> Número de RUC</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ej: 20123456789" 
                                        maxLength={20}
                                        value={formData.ruc}
                                        onChange={(e) => setFormData(prev => ({ ...prev, ruc: e.target.value }))}
                                        disabled={submitting}
                                    />
                                </div>
                                {errorMsg && (
                                    <div style={{ color: 'var(--status-error)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                                        <span>⚠️ {errorMsg}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className={cStyles.modalFooter}>
                            <button className={cStyles.cancelBtn} onClick={() => setShowModal('none')} disabled={submitting}>
                                Cancelar
                            </button>
                            <button 
                                className={cStyles.submitBtn} 
                                onClick={handleSaveCustomer} 
                                disabled={submitting || !formData.customer.trim() || !formData.ruc.trim()}
                            >
                                {submitting ? 'Guardando...' : 'Guardar Cliente'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación de Eliminación */}
            {showDeleteConfirm && customerToDelete && (
                <div className={cStyles.modalBackdrop} onClick={() => setShowDeleteConfirm(false)}>
                    <div className={cStyles.customerModal} style={{ maxWidth: '420px' }}>
                        <div className={cStyles.modalHeader}>
                            <h2>
                                <AlertTriangle size={20} color="var(--status-error)" />
                                Eliminar Cliente
                            </h2>
                            <button className={cStyles.modalClose} onClick={() => setShowDeleteConfirm(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={cStyles.modalBody}>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                ¿Estás seguro de que deseas eliminar permanentemente al cliente <strong>{customerToDelete.customer}</strong> con RUC <strong>{customerToDelete.ruc}</strong>? Esta acción no se puede deshacer.
                            </p>
                        </div>
                        <div className={cStyles.modalFooter}>
                            <button className={cStyles.cancelBtn} onClick={() => setShowDeleteConfirm(false)} disabled={submitting}>
                                Cancelar
                            </button>
                            <button 
                                className={cStyles.submitBtn} 
                                style={{ background: 'var(--status-error)', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.2)' }}
                                onClick={handleDeleteCustomer} 
                                disabled={submitting}
                            >
                                {submitting ? 'Eliminando...' : 'Eliminar Permanentemente'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
