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

### 2.1 Tabla: `users`
Almacena la información de los usuarios del sistema.
*   `id` (SERIAL, PK): Identificador único.
*   `first_name`, `second_name`, `last_name`, `second_last_name` (VARCHAR): Nombre completo del usuario.
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
*   `user_id` (INTEGER, FK -> `users.id`): Creador u operador que subió el reporte.
*   `name` (VARCHAR): Nombre del archivo PDF (ej: `Balanza_LIM_Reporte_Mar_2026.pdf`).
*   `creation_date` (TIMESTAMP): Fecha de carga.
*   `encargado_cierre` (INTEGER, FK -> `users.id`): Supervisor que firmó/cerró el documento.
*   `file_link` (TEXT): Enlace al archivo físico almacenado en Supabase Storage.
*   `status` (VARCHAR): Estado del reporte:
    *   `PENDIENTE`: Creado y en revisión.
    *   `CERRADO`: Bloqueado por el equipo de balanza.
    *   `HECHO`: Validado y aprobado por el área comercial (no modificable).
    *   `ERROR`: Reporte con inconsistencias.

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

### Componentes UI Clave:
1.  **`PdfPageCanvas`**: Utiliza la librería cliente `pdfjs-dist` para leer el buffer binario del PDF (`ArrayBuffer`) y renderizar en tiempo real una miniatura de la página específica en un elemento HTML `<canvas>`.
2.  **`EditorPage` (`src/app/editor/[id]/page.tsx`)**:
    *   **Drag & Drop**: Utiliza las APIs nativas de HTML5 (`onDragStart`, `onDragOver`, `onDrop`) para permitir el reordenamiento visual de las páginas del PDF.
    *   **Concatenación**: Permite cargar archivos PDF externos locales, leer sus páginas y agregarlas dinámicamente al flujo de páginas del reporte editado.
    *   **Firma visual**: Permite simular el estampado de una firma digital visual ("Revisado") en el documento.

---

## 4. Lógica de Negocio en Functions (Supabase Edge Functions)

Las funciones del backend planificadas se desarrollan como Supabase Edge Functions escritas en TypeScript y ejecutadas en Deno.
*   Ubicación actual: [Functions/](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/Functions)
*   **`users.ts`**: Ejemplo de servicio serverless que se conecta a la instancia de Supabase usando variables de entorno (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) y devuelve la lista de usuarios en formato JSON con cabeceras CORS habilitadas para permitir peticiones desde el frontend Next.js.

---

## 5. Diseño Visual y Estilos (Paltarumi Theme)

El diseño del portal sigue la estética corporativa de **Paltarumi SAC**:
*   **Modo Oscuro Industrial**: Fondo gris oscuro profundo con acentos de color ámbar/dorado representativos del sector de minería y refinado de metales.
*   **Variables CSS**: Centralizadas en [src/app/globals.css](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/src/app/globals.css).
    *   `--background`: `#0f172a` (slate oscuro)
    *   `--primary`: `#d97706` / `#f59e0b` (Paltarumi Gold / Amber)
    *   `--border`: `#334155` (borde sutil gris)
    *   `--text-primary`: `#f8fafc` (blanco roto)
    *   `--text-secondary`: `#94a3b8` (gris slate)
    *   Estados de alerta: Verde (`#10b981`), Rojo (`#ef4444`) e Info/Pendiente (`#f59e0b`).
