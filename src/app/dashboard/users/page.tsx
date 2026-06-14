'use client';

import React, { useState } from 'react';
import { 
    Search, UserPlus, UserX, Trash2, History, Shield, 
    CheckCircle, Save, Unlock, X, User, Mail, Lock, ChevronDown
} from 'lucide-react';
import styles from '../dashboard.module.css';
import userStyles from './users.module.css';
import { Tabs } from '@/components/ui/Tabs';
import { Modal, ConfirmModal, TraceabilityContent } from '@/components/ui/Modal';

const MOCK_USERS = [
    { id: 1, name: 'Elias Carmin', role: 'Administrador', email: 'elias@paltarumi.com', status: 'active', lastLogin: '2026-03-31 10:00 AM' },
    { id: 2, name: 'Juan Pérez', role: 'Operador', email: 'juan.perez@paltarumi.com', status: 'active', lastLogin: '2026-03-30 04:30 PM' },
    { id: 3, name: 'Carlos Ruíz', role: 'Supervisor', email: 'carlos.ruiz@paltarumi.com', status: 'active', lastLogin: '2026-03-31 09:12 AM' },
    { id: 4, name: 'Ana Torres', role: 'Supervisor', email: 'ana.torres@paltarumi.com', status: 'inactive', lastLogin: '2026-03-15 11:20 AM' },
    { id: 5, name: 'Luis Gómez', role: 'Operador', email: 'luis.gomez@paltarumi.com', status: 'inactive', lastLogin: '2026-03-20 08:00 AM' },
];

const MOCK_ROLES = [
    { id: 'admin', name: 'Administrador', users: 1, permissions: ['global_access', 'manage_users', 'audit_view', 'edit_all', 'delete_all'] },
    { id: 'supervisor', name: 'Supervisor', users: 2, permissions: ['audit_view', 'edit_region', 'approve_files'] },
    { id: 'operador', name: 'Operador', users: 2, permissions: ['upload_files', 'view_own'] },
];

const ROLES_LIST = ['Administrador', 'Supervisor', 'Operador'];

export default function UsersPage() {
    const [users, setUsers] = useState(MOCK_USERS);
    const [roles] = useState(MOCK_ROLES);
    const [confirmAction, setConfirmAction] = useState<{ id: number, type: 'delete' | 'deactivate' | 'activate' } | null>(null);
    const [showUserTrace, setShowUserTrace] = useState<number | null>(null);
    const [showNewUserModal, setShowNewUserModal] = useState(false);
    const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Operador', password: '' });

    const activeUsers = users.filter(u => u.status === 'active');
    const inactiveUsers = users.filter(u => u.status === 'inactive');

    const handleConfirm = () => {
        if (!confirmAction) return;
        if (confirmAction.type === 'delete') {
            setUsers(prev => prev.filter(u => u.id !== confirmAction.id));
        } else if (confirmAction.type === 'deactivate') {
            setUsers(prev => prev.map(u => u.id === confirmAction.id ? { ...u, status: 'inactive' } : u));
        } else if (confirmAction.type === 'activate') {
            setUsers(prev => prev.map(u => u.id === confirmAction.id ? { ...u, status: 'active' } : u));
        }
    };

    const handleCreateUser = () => {
        if (!newUser.name || !newUser.email) return;
        const nextId = Math.max(...users.map(u => u.id)) + 1;
        setUsers(prev => [...prev, {
            id: nextId,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            status: 'active',
            lastLogin: 'Nunca',
        }]);
        setNewUser({ name: '', email: '', role: 'Operador', password: '' });
        setShowNewUserModal(false);
    };

    const UserManagementView = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className={styles.tableSection}>
                <div className={styles.tableToolbar}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Usuarios Activos</h3>
                    <div className={styles.searchBox}>
                        <Search size={18} color="var(--text-secondary)" />
                        <input type="text" placeholder="Buscar usuario activo..." />
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Email</th>
                                <th>Rol</th>
                                <th>Último Acceso</th>
                                <th style={{ textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeUsers.map(user => (
                                <tr key={user.id}>
                                    <td style={{ fontWeight: 500 }}>{user.name}</td>
                                    <td>{user.email}</td>
                                    <td>
                                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', fontWeight: 600 }}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td>{user.lastLogin}</td>
                                    <td className={styles.actionsCell}>
                                        <button className={styles.actionBtn} title="Ver Trazabilidad" onClick={() => setShowUserTrace(user.id)}>
                                            <History size={16} />
                                        </button>
                                        <button className={styles.actionBtn} title="Desactivar Usuario" onClick={() => setConfirmAction({ id: user.id, type: 'deactivate' })}>
                                            <UserX size={16} color="#f59e0b" />
                                        </button>
                                        <button className={styles.deleteBtn} title="Eliminar Permanentemente" onClick={() => setConfirmAction({ id: user.id, type: 'delete' })}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className={styles.tableSection}>
                <div className={styles.tableToolbar}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Usuarios Desactivados</h3>
                    <div className={styles.searchBox}>
                        <Search size={18} color="var(--text-secondary)" />
                        <input type="text" placeholder="Buscar usuario desactivado..." />
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Email</th>
                                <th>Rol</th>
                                <th>Estado</th>
                                <th style={{ textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inactiveUsers.map(user => (
                                <tr key={user.id}>
                                    <td style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{user.name}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{user.email}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{user.role}</td>
                                    <td>
                                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 600 }}>
                                            Sin Acceso
                                        </span>
                                    </td>
                                    <td className={styles.actionsCell}>
                                        <button className={styles.actionBtn} title="Reactivar Usuario" onClick={() => setConfirmAction({ id: user.id, type: 'activate' })}>
                                            <CheckCircle size={16} color="var(--status-success)" />
                                        </button>
                                        <button className={styles.deleteBtn} title="Eliminar Permanentemente" onClick={() => setConfirmAction({ id: user.id, type: 'delete' })}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const RolesPermissionsView = () => (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' }}>
            <div className={styles.tableSection}>
                <div className={styles.tableToolbar}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Lista de Roles</h3>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <tbody>
                            {roles.map(role => (
                                <tr key={role.id}>
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{role.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{role.users} usuarios asignados</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className={styles.tableSection}>
                <div className={styles.tableToolbar}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Configuración de Permisos - Administrador</h3>
                    <button className={styles.actionBtn} style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                        <Save size={16} /> Guardar Cambios
                    </button>
                </div>
                <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                    {['Acceso Global', 'Gestionar Usuarios', 'Ver Auditoría', 'Editar Documentos', 'Eliminar Documentos', 'Aprobar Documentos', 'Exportar Data'].map((perm, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ color: 'var(--primary)' }}><Shield size={16} /></div>
                            <span style={{ fontSize: '0.875rem' }}>{perm}</span>
                            <div style={{ flex: 1 }} />
                            <button style={{ background: 'none', border: 'none', color: 'var(--status-success)', cursor: 'pointer' }}>
                                <Unlock size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Gestión de Usuarios</h1>
                    <p className={styles.subtitle}>Administra el personal, sus roles y los permisos de acceso al sistema.</p>
                </div>
                <button className={userStyles.newUserBtn} onClick={() => setShowNewUserModal(true)}>
                    <UserPlus size={18} />
                    <span>Nuevo Usuario</span>
                </button>
            </div>

            <Tabs tabs={[
                { id: 'management', label: 'Gestión de Cuentas', content: <UserManagementView /> },
                { id: 'roles', label: 'Roles y Permisos', content: <RolesPermissionsView /> }
            ]} />

            {/* New User Modal */}
            {showNewUserModal && (
                <div className={userStyles.modalBackdrop} onClick={(e) => { if (e.target === e.currentTarget) setShowNewUserModal(false); }}>
                    <div className={userStyles.newUserModal}>
                        <div className={userStyles.modalHeader}>
                            <h2><UserPlus size={22} /> Crear Nuevo Usuario</h2>
                            <button className={userStyles.modalClose} onClick={() => setShowNewUserModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className={userStyles.modalBody}>
                            <div className={userStyles.avatarPreview}>
                                <div className={userStyles.avatarCircle}>
                                    {newUser.name ? newUser.name.charAt(0).toUpperCase() : <User size={32} />}
                                </div>
                                <div className={userStyles.avatarInfo}>
                                    <div className={userStyles.avatarName}>{newUser.name || 'Nombre del usuario'}</div>
                                    <div className={userStyles.avatarRole}>{newUser.role}</div>
                                </div>
                            </div>

                            <div className={userStyles.form}>
                                <div className={userStyles.formGroup}>
                                    <label><User size={14} /> Nombre completo</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Juan Pérez"
                                        value={newUser.name}
                                        onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))}
                                    />
                                </div>
                                <div className={userStyles.formGroup}>
                                    <label><Mail size={14} /> Correo electrónico</label>
                                    <input
                                        type="email"
                                        placeholder="usuario@paltarumi.com"
                                        value={newUser.email}
                                        onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))}
                                    />
                                </div>
                                <div className={userStyles.formGroup}>
                                    <label><Shield size={14} /> Rol de acceso</label>
                                    <div className={userStyles.selectWrapper}>
                                        <select
                                            value={newUser.role}
                                            onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                                        >
                                            {ROLES_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                        <ChevronDown size={16} className={userStyles.selectIcon} />
                                    </div>
                                </div>
                                <div className={userStyles.formGroup}>
                                    <label><Lock size={14} /> Contraseña temporal</label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={newUser.password}
                                        onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={userStyles.modalFooter}>
                            <button className={userStyles.cancelBtn} onClick={() => setShowNewUserModal(false)}>Cancelar</button>
                            <button className={userStyles.submitBtn} onClick={handleCreateUser} disabled={!newUser.name || !newUser.email}>
                                <UserPlus size={16} /> Crear Usuario
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal 
                isOpen={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                onConfirm={handleConfirm}
                title={confirmAction?.type === 'delete' ? 'Eliminar Usuario' : confirmAction?.type === 'deactivate' ? 'Desactivar Usuario' : 'Activar Usuario'}
                message={
                    confirmAction?.type === 'delete' 
                        ? '¿Estás seguro de que deseas eliminar permanentemente este usuario? Esta acción no se puede deshacer.'
                        : confirmAction?.type === 'deactivate'
                        ? '¿Deseas deshabilitar el acceso de este usuario? Ya no podrá iniciar sesión hasta que sea reactivado.'
                        : '¿Deseas habilitar nuevamente el acceso para este usuario?'
                }
                confirmText={confirmAction?.type === 'delete' ? 'Eliminar Definitivamente' : confirmAction?.type === 'deactivate' ? 'Desactivar' : 'Activar'}
                type={confirmAction?.type === 'activate' ? 'info' : confirmAction?.type === 'deactivate' ? 'warning' : 'danger'}
            />

            <Modal
                isOpen={!!showUserTrace}
                onClose={() => setShowUserTrace(null)}
                title={`Trazabilidad - ${users.find(u => u.id === showUserTrace)?.name}`}
                icon={<History size={20} color="var(--primary)" />}
            >
                <div style={{ padding: '0 0.5rem' }}>
                    <TraceabilityContent reportId="user-history" />
                </div>
            </Modal>
        </div>
    );
}
