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
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setErrorMsg(error.message);
            } else {
                router.push('/dashboard');
            }
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
