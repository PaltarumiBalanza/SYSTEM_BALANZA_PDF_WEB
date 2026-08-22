# Documentación Técnica: PDF Mining Web Hub (SYSTEM_BALANZA_PDF_WEB)

Este documento detalla la arquitectura técnica, la estructura de la base de datos y la organización del frontend de la aplicación web **PDF Mining Web Hub**, un sistema diseñado para centralizar, editar y autorizar reportes PDF de pesaje generados por balanzas mineras de Paltarumi SAC.

---

## 1. Arquitectura General del Sistema

El sistema está estructurado como una aplicación moderna de dos capas principales (Frontend y Backend) utilizando tecnologías web de alto rendimiento.

*   **Frontend**: Next.js (App Router) con TypeScript, estilado con CSS Modules nativos (Vanilla CSS) para maximizar la velocidad de carga y flexibilidad estética.
*   **Backend (Planificado)**: Supabase, el cual proveerá la Base de Datos PostgreSQL, Autenticación de Usuarios, Almacenamiento de Archivos (Bucket de PDFs) y Funciones Serverless (Edge Functions) ejecutadas en Deno.
*   **Estado de Integración**: Actualmente el proyecto se encuentra en fase de **Prototipado High-Fidelity Frontend**. Toda la lógica de autenticación, comentarios, trazabilidad y datos está mockeada en el cliente. La estructura del backend está pre-diseñada y documentada en los directorios `Database` y `Functions` para su posterior implementación física en Supabase.

---

## 2. Modelo de Datos (Base de Datos en Supabase)

El esquema de base de datos relacional para Supabase se encuentra documentado en [Database/Esquema.db](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/Database/Esquema.db). A continuación se describe la estructura de las tablas principales:

### 2.1 Tabla: `users` (Perfiles Públicos)
Almacena la información de los usuarios del sistema.
*   `id` (UUID, PK): Identificador único que referencia directamente a `auth.users.id` (Supabase Auth).
*   `first_name`, `second_name`, `last_name`, `second_last_name` (VARCHAR): Nombre completo del usuario.
*   `email` (VARCHAR): Dirección de correo electrónico del usuario (sincronizada desde la cuenta de autenticación).
*   `creation_date` (TIMESTAMP): Fecha de registro.
*   `date_birthday` (DATE): Fecha de nacimiento.
*   `status` (CHAR(1)): Estado del usuario (`A` para Activo, `I` para Inactivo).

### 2.2 Tablas de Control de Acceso (RBAC)
*   `roles`: Define los roles disponibles en el sistema (`ADMIN`, `EDITOR`, `VIEWER`).
*   `permissions`: Define los permisos individuales (`CREATE_DOCUMENT`, `VIEW_DOCUMENT`, `EDIT_DOCUMENT`, `DELETE_DOCUMENT`, `COMMENT_DOCUMENT`, `CLOSE_DOCUMENT`).
*   `role_permissions`: Relación N:M que asocia permisos a roles.
*   `user_roles`: Relación N:M que asigna roles a los usuarios.

### 2.3 Tabla: `documents`
Almacena los metadatos de los reportes PDF.
*   `id` (SERIAL, PK): Identificador único del reporte.
*   `user_id` (INTEGER / UUID, FK -> `users.id`): Creador u operador que subió el reporte.
*   `name` (VARCHAR): Nombre del archivo PDF (conserva espacios reales, ej: `01-E6080 oro negro compania minera s.a.c.pdf`).
*   `creation_date` (TIMESTAMP): Fecha de carga.
*   `encargado_cierre` (INTEGER / UUID, FK -> `users.id`): Supervisor o balanza que cerró/firmó el documento.
*   `file_link` (TEXT): Enlace o ruta del archivo físico almacenado en Supabase Storage (`raw-reports` para borradores, `final-reports` para compilados).
*   `status` (VARCHAR): Estado del reporte:
    *   `PENDIENTE`: Creado y en revisión.
    *   `CERRADO POR BALANZA`: Revisado y cerrado por el área de Balanza (listo para aprobación comercial).
    *   `OBSERVADO`: Marcado por Balanza al detectar alguna observación pendiente de revisión.
    *   `HECHO`: Validado, aprobado y completado por el área comercial (totalmente inmutable, solo lectura).
    *   `ERROR`: Invalidado por falla o inconsistencia de datos.

### 2.4 Tabla: `comments`
Comentarios y feedback dejados por los usuarios en cada reporte.
*   `id` (SERIAL, PK): Identificador del comentario.
*   `document_id` (INTEGER, FK -> `documents.id`): Documento comentado.
*   `user_id` (INTEGER, FK -> `users.id`): Autor del comentario.
*   `comment` (TEXT): Contenido.
*   `creation_date` (TIMESTAMP): Fecha del comentario.

### 2.5 Tabla: `audit_documents`
Historial de trazabilidad de cambios en los reportes.
*   `id` (SERIAL, PK): Identificador único de auditoría.
*   `document_id` (INTEGER, FK -> `documents.id`).
*   `user_id` (INTEGER, FK -> `users.id`): Quién realizó el cambio.
*   `action` (VARCHAR): Acción realizada (`CREATE`, `UPDATE`, `DELETE`, `CLOSE`).
*   `modification_date` (TIMESTAMP): Fecha de la acción.

---

## 3. Estructura y Componentes de Frontend (Next.js)

La estructura del código frontend se organiza en `src/`:

```
src/
├── app/
│   ├── dashboard/
│   │   ├── audit/            # Vista de auditoría general
│   │   ├── logs/             # Logs del sistema
│   │   ├── settings/         # Configuración del sistema
│   │   ├── users/            # Gestión de usuarios
│   │   ├── layout.tsx        # Layout con menú lateral (Sidebar) de Paltarumi
│   │   ├── page.tsx          # Panel de control: buscador, filtros y tabla de reportes
│   │   └── dashboard.module.css
│   ├── editor/
│   │   └── [id]/
│   │       ├── page.tsx      # Editor interactivo de PDF
│   │       └── editor.module.css
│   ├── login/
│   │   ├── page.tsx          # Pantalla de autenticación
│   │   └── login.module.css
│   ├── globals.css           # Variables de diseño (Colores Paltarumi, tipografía)
│   ├── layout.tsx            # Contenedor raíz de la aplicación
│   └── page.tsx              # Redirección inicial a /login
└── components/
    └── ui/
        ├── Modal.tsx         # Ventanas emergentes (Trazabilidad y Comentarios)
        ├── Modal.module.css
        └── PdfPageCanvas.tsx # Renderizador de miniaturas de páginas PDF con pdfjs-dist
```

### Componentes UI y Autenticación Clave:
1.  **`AuthListener` (`src/components/auth/AuthListener.tsx`)**: Monitorea de forma continua la validez de la sesión y expiración del JWT token de Supabase. Al detectar caducidad o desconexión por inactividad, despliega automáticamente un modal explicativo ("Inicio de Sesión Caducado") y redirige al usuario a la pantalla de login (`/login`).
2.  **`PdfPageCanvas`**: Utiliza la librería cliente `pdfjs-dist` para leer el buffer binario del PDF (`ArrayBuffer`) y renderizar en tiempo real una miniatura de la página específica en un elemento HTML `<canvas>`.
3.  **`EditorPage` (`src/app/editor/[id]/page.tsx`)**:
    *   **Drag & Drop (Exclusivo Balanza/Admin)**: Permite el reordenamiento visual de las páginas del PDF únicamente para roles autorizados. Deshabilitado para el área Comercial.
    *   **Concatenación**: Permite a Balanza/Admin cargar archivos PDF externos locales y agregarlos al flujo.

---

## 4. Lógica de Negocio (Supabase Edge Functions)

Las funciones del backend se desarrollan como Supabase Edge Functions escritas en TypeScript y ejecutadas en Deno.
*   **Estructura de Directorio**: Deben alojarse bajo la ruta estándar de la CLI: `supabase/functions/<nombre_de_funcion>/index.ts`.
*   **Funciones Implementadas**:
    *   [`supabase/functions/sync-desktop-report/index.ts`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/supabase/functions/sync-desktop-report/index.ts): Gestiona la sincronización automática de reportes preliminares subidos desde el software de escritorio, su registro en base de datos y alertas por email mediante Resend.
    *   [`supabase/functions/compile-and-sign-pdf/index.ts`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/supabase/functions/compile-and-sign-pdf/index.ts): Recibe el flujo ordenado de páginas, las concatena y extrae con `pdf-lib`, estampa la firma/sello de Balanza y guarda el PDF final en `final-reports`. Soporta recuperación fallback dual (`raw-reports` ↔ `final-reports`).

---

## 5. Diseño Visual y Estilos (Paltarumi Theme & Código de Colores)

El diseño del portal sigue la estética corporativa de **Paltarumi SAC**:
*   **Modo Oscuro Industrial**: Fondo gris oscuro profundo con acentos de color ámbar/dorado representativos del sector de minería y refinado de metales.
*   **Variables CSS**: Centralizadas en [src/app/globals.css](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/src/app/globals.css).
    *   `--background`: `#0f172a` (slate oscuro)
    *   `--primary`: `#d97706` / `#f59e0b` (Paltarumi Gold / Amber)
    *   `--border`: `#334155` (borde sutil gris)
    *   `--text-primary`: `#f8fafc` (blanco roto)
    *   `--text-secondary`: `#94a3b8` (gris slate)
*   **Código de Colores Unificado**:
    *   **COMPLETADO (`HECHO`)**: Verde Sólido (`#10b981`)
    *   **CERRADO POR BALANZA (`CERRADO POR BALANZA`)**: Azul Sólido (`#3b82f6`)
    *   **ERROR (`ERROR`)**: Rojo (`#ef4444`)
    *   **PENDIENTE (`PENDIENTE`)**: Amarillo / Ámbar (`#f59e0b`)
    *   **OBSERVADO (`OBSERVADO`)**: Ámbar / Naranja (`#f59e0b`)
