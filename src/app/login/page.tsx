'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function LoginPage() {
    const router = useRouter();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        router.push('/dashboard');
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

                <div className={styles.formGroup}>
                    <label className={styles.label}>Cuenta de Usuario</label>
                    <input 
                        type="text" 
                        className={styles.input} 
                        placeholder="Elias Carmin" 
                        defaultValue="Elias Carmin"
                        required 
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Clave Segura</label>
                    <input 
                        type="password" 
                        className={styles.input} 
                        placeholder="••••••••" 
                        defaultValue="paltarumi123"
                        required 
                    />
                </div>

                <button type="submit" className={styles.button}>Acceder al Sistema</button>
                
                <div className={styles.footer}>
                    &copy; 2026 Paltarumi SAC. Todos los derechos reservados.
                </div>
            </form>
        </main>
    );
}
