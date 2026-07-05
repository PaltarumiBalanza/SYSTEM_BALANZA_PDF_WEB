'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('elias.carmin@paltarumi.com');
    const [password, setPassword] = useState('paltarumi123');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setLoading(true);

        try {
            const { data: authData, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setErrorMsg(error.message);
                setLoading(false);
                return;
            }

            const authUser = authData.user;

            // 1. Obtener el perfil público del usuario
            const { data: userProfile, error: profileError } = await supabase
                .from('users')
                .select('status')
                .eq('id', authUser.id)
                .single();

            if (profileError) {
                console.warn("Perfil público de usuario no encontrado:", profileError.message);
                router.push('/dashboard');
                return;
            }

            // 2. Validar si está inactivo (Desactivado)
            if (userProfile.status === 'I') {
                setErrorMsg('Esta cuenta ha sido desactivada. Por favor, contacte al administrador.');
                await supabase.auth.signOut();
                setLoading(false);
                return;
            }

            // 3. Registrar fecha de último acceso en public.users
            await supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', authUser.id);

            router.push('/dashboard');
        } catch (err: any) {
            setErrorMsg(err.message || 'Ocurrió un error inesperado');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className={styles.container}>
            <form className={styles.card} onSubmit={handleLogin}>
                <div className={styles.header}>
                    <div className={styles.logoWrapper}>
                        <Image 
                            src="/paltarumi.png" 
                            alt="Paltarumi Logo" 
                            width={200} 
                            height={60} 
                            style={{ objectFit: 'contain' }} 
                            priority 
                        />
                    </div>
                    <p>Autenticación de Inteligencia Paltarumi</p>
                </div>

                {errorMsg && (
                    <div className={styles.errorAlert}>
                        {errorMsg}
                    </div>
                )}

                <div className={styles.formGroup}>
                    <label className={styles.label}>Correo Electrónico</label>
                    <input 
                        type="email" 
                        className={styles.input} 
                        placeholder="elias.carmin@paltarumi.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required 
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Clave Segura</label>
                    <input 
                        type="password" 
                        className={styles.input} 
                        placeholder="••••••••" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required 
                    />
                </div>

                <button 
                    type="submit" 
                    className={styles.button}
                    disabled={loading}
                >
                    {loading ? 'Accediendo...' : 'Acceder al Sistema'}
                </button>
                
                <div className={styles.footer}>
                    &copy; 2026 Paltarumi SAC. Todos los derechos reservados.
                </div>
            </form>
        </main>
    );
}
