'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Search, UserPlus, UserX, Trash2, History, Shield, 
    CheckCircle, Save, Unlock, X, User, Mail, Lock, ChevronDown
} from 'lucide-react';
import styles from '../dashboard.module.css';
import userStyles from './users.module.css';
import { Tabs } from '@/components/ui/Tabs';
import { Modal, ConfirmModal, TraceabilityContent } from '@/components/ui/Modal';
import { supabase } from '@/lib/supabaseClient';

const MOCK_ROLES = [
    { id: 'admin', name: 'Administrador', users: 1, permissions: ['global_access', 'manage_users', 'audit_view', 'edit_all', 'delete_all'] },
    { id: 'supervisor', name: 'Comercial', users: 2, permissions: ['audit_view', 'edit_region', 'approve_files'] },
    { id: 'operador', name: 'Balanza', users: 2, permissions: ['upload_files', 'view_own'] },
];

const ROLES_LIST = ['Administrador', 'Comercial', 'Balanza'];

export default function UsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<any[]>([]);
    const [dbRoles, setDbRoles] = useState<any[]>([]);
    const [dbPermissions, setDbPermissions] = useState<any[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [activePermissions, setActivePermissions] = useState<number[]>([]);
    const [savingPermissions, setSavingPermissions] = useState(false);
    const [loading, setLoading] = useState(true);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ id: number, type: 'delete' | 'deactivate' | 'activate' } | null>(null);
    const [showUserTrace, setShowUserTrace] = useState<number | null>(null);
    const [showNewUserModal, setShowNewUserModal] = useState(false);
    const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Balanza', password: '' });

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select(`
                    id,
                    first_name,
                    second_name,
                    last_name,
                    second_last_name,
                    email,
                    status,
                    creation_date,
                    last_login,
                    user_roles (
                        role_id,
                        roles (name)
                    )
                `);

            if (error) throw error;

            const mapped = (data || []).map((u: any) => {
                const roleName = u.user_roles?.[0]?.roles?.name || 'VIEWER';
                const nombreCompleto = [u.first_name, u.second_name, u.last_name, u.second_last_name]
                    .filter(Boolean)
                    .join(' ');

                return {
                    id: u.id,
                    name: nombreCompleto || 'Usuario sin nombre',
                    email: u.email || `${u.first_name.toLowerCase().replace(/\s+/g, '')}@paltarumi.com`,
                    role: roleName === 'ADMIN' ? 'Administrador' : roleName === 'EDITOR' ? 'Comercial' : 'Balanza',
                    status: u.status === 'A' ? 'active' : 'inactive',
                    lastLogin: u.last_login ? new Date(u.last_login).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'Nunca'
                };
            });

            setUsers(mapped);
        } catch (err) {
            console.error('Error al obtener usuarios:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchRolesAndPermissions = async () => {
        try {
            const { data: permData, error: permError } = await supabase
                .from('permissions')
                .select('*')
                .order('id');
            if (permError) throw permError;
            setDbPermissions(permData || []);

            const { data: roleData, error: roleError } = await supabase
                .from('roles')
                .select(`
                    id,
                    name,
                    description,
                    user_roles (user_id),
                    role_permissions (permission_id)
                `);
            
            if (roleError) throw roleError;

            const formattedRoles = (roleData || []).map((r: any) => ({
                id: r.id,
                name: r.name === 'ADMIN' ? 'Administrador' : r.name === 'EDITOR' ? 'Comercial' : 'Balanza',
                dbName: r.name,
                description: r.description,
                usersCount: r.user_roles?.length || 0,
                permissions: r.role_permissions.map((rp: any) => rp.permission_id)
            }));

            setDbRoles(formattedRoles);

            if (formattedRoles.length > 0) {
                setSelectedRoleId(prev => {
                    const currentId = prev !== null ? prev : formattedRoles[0].id;
                    const activeRole = formattedRoles.find(role => role.id === currentId);
                    if (activeRole) {
                        setActivePermissions(activeRole.permissions);
                    }
                    return currentId;
                });
            }
        } catch (err) {
            console.error('Error al obtener roles y permisos:', err);
        }
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

                if (!error && data?.roles?.name === 'ADMIN') {
                    setIsAuthorized(true);
                    fetchUsers();
                    fetchRolesAndPermissions();
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

    const activeUsers = users.filter(u => u.status === 'active');
    const inactiveUsers = users.filter(u => u.status === 'inactive');

    const handleConfirm = async () => {
        if (!confirmAction) return;

        try {
            if (confirmAction.type === 'delete') {
                const { error } = await supabase
                    .from('users')
                    .delete()
                    .eq('id', confirmAction.id);
                if (error) throw error;
                setUsers(prev => prev.filter(u => u.id !== confirmAction.id));
            } else if (confirmAction.type === 'deactivate') {
                const { error } = await supabase
                    .from('users')
                    .update({ status: 'I' })
                    .eq('id', confirmAction.id);
                if (error) throw error;
                setUsers(prev => prev.map(u => u.id === confirmAction.id ? { ...u, status: 'inactive' } : u));
            } else if (confirmAction.type === 'activate') {
                const { error } = await supabase
                    .from('users')
                    .update({ status: 'A' })
                    .eq('id', confirmAction.id);
                if (error) throw error;
                setUsers(prev => prev.map(u => u.id === confirmAction.id ? { ...u, status: 'active' } : u));
            }
        } catch (err: any) {
            alert('Error al actualizar usuario: ' + err.message);
        } finally {
            setConfirmAction(null);
        }
    };

    const handleCreateUser = async () => {
        if (!newUser.name || !newUser.email) return;

        try {
            const { data, error } = await supabase.functions.invoke('create-user', {
                body: {
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role,
                    password: newUser.password || undefined
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            fetchUsers();
            setNewUser({ name: '', email: '', role: 'Operador', password: '' });
            setShowNewUserModal(false);
        } catch (err: any) {
            alert('Error al crear usuario: ' + err.message);
        }
    };

    const handleRoleChange = async (userId: string, newRoleLabel: string) => {
        try {
            const dbRoleName = newRoleLabel === 'Administrador' ? 'ADMIN' : newRoleLabel === 'Comercial' ? 'EDITOR' : 'VIEWER';
            
            const { data: roleData, error: roleError } = await supabase
                .from('roles')
                .select('id')
                .eq('name', dbRoleName)
                .single();

            if (roleError || !roleData) throw new Error('Rol no encontrado en la base de datos.');

            const { error: deleteError } = await supabase
                .from('user_roles')
                .delete()
                .eq('user_id', userId);

            if (deleteError) throw deleteError;

            const { error: insertError } = await supabase
                .from('user_roles')
                .insert({
                    user_id: userId,
                    role_id: roleData.id
                });

            if (insertError) throw insertError;

            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRoleLabel } : u));
        } catch (err: any) {
            alert('Error al actualizar el rol: ' + err.message);
        }
    };

    const handleRoleSelect = (roleId: number) => {
        setSelectedRoleId(roleId);
        const role = dbRoles.find(r => r.id === roleId);
        if (role) {
            setActivePermissions(role.permissions);
        }
    };

    const handlePermissionToggle = (permId: number) => {
        setActivePermissions(prev => {
            if (prev.includes(permId)) {
                return prev.filter(id => id !== permId);
            } else {
                return [...prev, permId];
            }
        });
    };

    const handleSavePermissions = async () => {
        if (selectedRoleId === null) return;
        setSavingPermissions(true);
        try {
            const { error: deleteError } = await supabase
                .from('role_permissions')
                .delete()
                .eq('role_id', selectedRoleId);
            
            if (deleteError) throw deleteError;

            if (activePermissions.length > 0) {
                const insertData = activePermissions.map(pid => ({
                    role_id: selectedRoleId,
                    permission_id: pid
                }));

                const { error: insertError } = await supabase
                    .from('role_permissions')
                    .insert(insertData);

                if (insertError) throw insertError;
            }

            alert('Permisos actualizados con éxito.');
            await fetchRolesAndPermissions();
        } catch (err: any) {
            alert('Error al guardar permisos: ' + err.message);
        } finally {
            setSavingPermissions(false);
        }
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
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            Cargando usuarios activos...
                        </div>
                    ) : activeUsers.length === 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            No hay usuarios activos registrados.
                        </div>
                    ) : (
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
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                className={userStyles.inlineRoleSelect}
                                            >
                                                <option value="Administrador">Administrador</option>
                                                <option value="Comercial">Comercial</option>
                                                <option value="Balanza">Balanza</option>
                                            </select>
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
                    )}
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
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            Cargando usuarios desactivados...
                        </div>
                    ) : inactiveUsers.length === 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            No hay usuarios desactivados.
                        </div>
                    ) : (
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
                                        <td>
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                className={userStyles.inlineRoleSelect}
                                            >
                                                <option value="Administrador">Administrador</option>
                                                <option value="Comercial">Comercial</option>
                                                <option value="Balanza">Balanza</option>
                                            </select>
                                        </td>
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
                    )}
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
                            {dbRoles.map(role => (
                                <tr 
                                    key={role.id}
                                    onClick={() => handleRoleSelect(role.id)}
                                    style={{ 
                                        backgroundColor: role.id === selectedRoleId ? 'rgba(212, 160, 23, 0.12)' : 'transparent',
                                        borderLeft: role.id === selectedRoleId ? '4px solid var(--primary)' : '4px solid transparent',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ fontWeight: 600, color: role.id === selectedRoleId ? 'var(--primary)' : 'var(--text-primary)' }}>{role.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{role.usersCount} usuarios asignados</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className={styles.tableSection}>
                <div className={styles.tableToolbar}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
                        Configuración de Permisos - {dbRoles.find(r => r.id === selectedRoleId)?.name || ''}
                    </h3>
                    <button 
                        className={styles.actionBtn} 
                        style={{ backgroundColor: 'var(--primary)', color: 'white', opacity: savingPermissions ? 0.6 : 1 }}
                        onClick={handleSavePermissions}
                        disabled={savingPermissions || selectedRoleId === null}
                    >
                        <Save size={16} /> {savingPermissions ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
                <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                    {dbPermissions.map((perm) => {
                        const isAuthorized = activePermissions.includes(perm.id);
                        return (
                            <div 
                                key={perm.id} 
                                onClick={() => handlePermissionToggle(perm.id)}
                                style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '0.75rem', 
                                    padding: '0.75rem 1rem', 
                                    backgroundColor: isAuthorized ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255,255,255,0.01)', 
                                    border: isAuthorized ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border)', 
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ color: isAuthorized ? 'var(--status-success)' : 'var(--text-secondary)' }}>
                                    <Shield size={16} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isAuthorized ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                        {perm.description || perm.name}
                                    </span>
                                </div>
                                <div style={{ flex: 1 }} />
                                <button 
                                    style={{ 
                                        background: 'none', 
                                        border: 'none', 
                                        color: isAuthorized ? 'var(--status-success)' : 'var(--text-secondary)', 
                                        cursor: 'pointer' 
                                    }}
                                >
                                    {isAuthorized ? <Unlock size={16} /> : <Lock size={16} />}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
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
                    Esta sección es de uso exclusivo para Administradores de Paltarumi SAC. Si necesitas privilegios adicionales, solicita la aprobación de gerencia.
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
