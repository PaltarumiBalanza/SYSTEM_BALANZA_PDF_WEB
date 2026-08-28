# AI Agent Skill Guide: Mantenimiento y Desarrollo de SYSTEM_BALANZA_PDF_WEB

Este documento sirve como manual de referencia y "skill" para cualquier agente de inteligencia artificial que deba trabajar en este repositorio. Define la arquitectura, convenciones de código y pasos guiados para realizar integraciones y extensiones comunes.

---

## 1. Mapa de Orientación del Repositorio

Familiarízate con la distribución del código antes de proponer cambios:

*   [`/src/app`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/src/app): Rutas de Next.js (App Router). Contiene el flujo de pantallas (`login`, `dashboard`, `editor/[id]`).
*   [`/src/components/dashboard`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/src/components/dashboard): Vista compartida de paneles PSAC/ECOGOLD (`DashboardView.tsx`).
*   [`/src/components/ui`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/src/components/ui): Componentes UI compartidos (`Modal.tsx`, `PdfPageCanvas.tsx`).
*   [`/Database`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/Database): Esquemas de base de datos PostgreSQL/Supabase ([`Esquema.db`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/Database/Esquema.db)) e historial de consultas de referencia.
*   [`/supabase/functions`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/supabase/functions): Funciones Serverless de Supabase (Deno/Edge Functions) estructuradas en subcarpetas según demanda del CLI.
*   [`/Functions`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/Functions): Archivos de respaldo iniciales.

---

## 2. Reglas del Proyecto y Estándares de Diseño

### 2.1 Estilos y CSS
*   **Prohibición de TailwindCSS**: El proyecto utiliza **Vanilla CSS Modules** (`*.module.css`) para el encapsulamiento de estilos. No agregues clases utilitarias de TailwindCSS a menos que el usuario lo solicite explícitamente.
*   **Variables de Diseño**: Usa siempre las variables semánticas declaradas en [`globals.css`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/src/app/globals.css):
    *   Fondo: `var(--background)` (`#0f172a`)
    *   Acento Dorado: `var(--primary)` (`#d97706`)
    *   Bordes: `var(--border)` (`#334155`)
    *   Textos: `var(--text-primary)` (`#f8fafc`), `var(--text-secondary)` (`#94a3b8`)
    *   Estados: `var(--status-success)` (`#10b981`), `var(--status-error)` (`#ef4444`)

### 2.2 Convenciones de Código
*   **TypeScript Estricto**: Define interfaces claras para todas las respuestas de API y estados locales (ver por ejemplo `PageItem` en el editor).
*   **Manipulación de PDFs**: La manipulación de PDFs en el cliente se realiza leyendo el archivo como `ArrayBuffer` y pasándolo a `pdfjs-dist` para el renderizado local de miniaturas en `<canvas>`.
*   **Nomenclatura de archivos**: No sanitizar nombres a guiones bajos en subidas ni renombrados del dashboard. Preservar espacios (ej: `34 pato.pdf`). La sanitización agresiva solo aplica a anexos locales en el editor (`sanitizeFileName` en anexos).

---

## 3. Recetario de Tareas de IA (AI Recipes)

Sigue estos procedimientos paso a paso al recibir peticiones sobre este proyecto:

### Receta A: Consultar reportes en Dashboard (PSAC / ECOGOLD)

El dashboard ya está conectado a Supabase vía [`DashboardView.tsx`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/src/components/dashboard/DashboardView.tsx):

```typescript
// Documentos por empresa
const { data } = await supabase
    .from('documents')
    .select('id, name, status, creation_date, region, company, file_link, users:users!user_id(first_name, last_name)')
    .eq('company', 'PSAC') // o 'ECOGOLD'
    .order('id', { ascending: false });

// Última modificación por (batch)
const { data: auditData } = await supabase
    .from('audit_documents')
    .select('document_id, modification_date, users(first_name, last_name)')
    .in('document_id', docIds)
    .order('modification_date', { ascending: false });
// Tomar la primera entrada por document_id
```

### Receta B: Conexión de Autenticación de Usuarios

Para sustituir el bypass de login actual en [`src/app/login/page.tsx`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/src/app/login/page.tsx):

1.  Usa el método `supabase.auth.signInWithPassword`:
    ```typescript
    const { error } = await supabase.auth.signInWithPassword({
        email: emailState,
        password: passwordState,
    });
    if (!error) router.push('/dashboard');
    ```
2.  Asegúrate de mapear los perfiles de usuario y roles tras la autenticación utilizando la tabla relacional `user_roles`.

### Receta C: Despliegue de Edge Functions

Para crear nuevas funciones serverless en `/supabase/functions`:

1.  Crea la carpeta de la función (ej: `supabase/functions/create-pdf/index.ts`).
2.  Asegúrate de incluir las cabeceras CORS (`Access-Control-Allow-Origin: '*'`) para permitir llamadas del cliente.
3.  Prueba localmente o despliega usando Supabase CLI:
    ```bash
    supabase functions serve
    supabase functions deploy create-pdf
    ```

### Receta D: Guardar los Cambios del Editor de PDF en Storage

Cuando el supervisor guarde los cambios en [`src/app/editor/[id]/page.tsx`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/src/app/editor/%5Bid%5D/page.tsx):

1.  Utiliza una librería como `pdf-lib` en el cliente para reconstruir físicamente el PDF a partir del array reordenado de páginas (extrayendo páginas del buffer binario original de cada archivo).
2.  Sube el archivo resultante a un bucket de Supabase Storage:
    ```typescript
    const { data, error } = await supabase.storage
        .from('scale-reports')
        .upload(`report_${reportId}.pdf`, pdfBlob, { upsert: true });
    ```
3.  Actualiza el registro en la tabla `documents` con la URL del archivo y cambia el estado a `HECHO`.

### Receta E: Subida desde Software de Escritorio (`sync-desktop-report`)

1.  Enviar `POST` multipart a `/functions/v1/sync-desktop-report` con cabecera `Authorization: Bearer <JWT>`.
2.  Campos del FormData:
    *   `file` — Blob PDF (requerido).
    *   `filename` — Nombre visible deseado (recomendado, ej: `34 pato.pdf`).
    *   `region`, `company` / `empresa` — Metadatos.
3.  La función `resolveDocumentName()` preserva espacios; **no** convierte a guiones bajos.
4.  Desplegar tras cambios: `supabase functions deploy sync-desktop-report`.

### Receta F: Renombrar documentos (`rename-document`)

1.  Invocar desde el dashboard con `POST` a `/functions/v1/rename-document` y body `{ documentId, newName }`.
2.  Reglas de bucket:
    *   `PENDIENTE` / `OBSERVADO` / `ERROR` → renombra en `raw-reports`.
    *   `CERRADO POR BALANZA` / `HECHO` → renombra en `final-reports` (PDF firmado).
3.  **Nunca** mover el PDF crudo al renombrar estados cerrados.
4.  Desplegar tras cambios: `supabase functions deploy rename-document`.
