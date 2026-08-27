# 📋 Historial Completo de Bugs, Diagnósticos y Correcciones
**Sistema de Gestión de Autorizaciones de Reportes PDF de Balanza — Paltarumi SAC**

---

## 1. Bug #1: Duplicación y Corrupción de Páginas al Re-Cerrar / Corregir Reportes
* **Síntoma**: Al abrir y editar reportes en estado `ERROR` u `OBSERVADO` y volver a presionar *"Cerrar por Balanza"* o *"Marcar como Completado"*, las páginas del PDF se duplicaban exponencialmente y los sellos de firma se encimaban sobre firmas anteriores (ej: reportes `#214`, `#244`, `#410`).
* **Diagnóstico Forense**:
  - En la función `loadOriginalPdf` de `src/app/editor/[id]/page.tsx`, cuando un documento venía de ser cerrado anteriormente, su campo `file_link` apuntaba a la ruta del PDF compilado firmado (`signed-xxx.pdf` en `final-reports`).
  - Al procesar el borrador (`draftOps`), la regla `resolvedPath` reemplazaba la ruta del PDF crudo original por `originalPath` (`signed-xxx.pdf`).
  - Al enviar las operaciones a la Edge Function `compile-and-sign-pdf`, esta recibía como archivo fuente el **PDF ya compilado con 15 hojas firmadas**, agregaba las hojas nuevamente y le estampaba un segundo sello encima.
* **Solución**:
  - Aislamiento estricto de fuentes en [`src/app/editor/[id]/page.tsx`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/src/app/editor/%5Bid%5D/page.tsx): Las páginas base del documento ahora se leen **estrictamente desde el PDF crudo original en `raw-reports`**.
  - Cada re-cierre genera una compilación limpia de 1 solo sello sobre el PDF crudo + anexos.

---

## 2. Bug #2: Fallo de Cierre por Balanza (`Edge Function returned a non-2xx status code` / FK `fk_encargado_cierre`)
* **Síntoma**: Los miembros del área de Balanza (rol `VIEWER`) recibían una alerta de error al hacer clic en *"Cerrar por Balanza"* (ej: reporte `cap-870.pdf`), mientras que a los usuarios Administradores sí les permitía cerrar.
* **Causa Raíz**:
  - La Edge Function `compile-and-sign-pdf` intentaba insertar el `user.id` del miembro de Balanza como `encargado_cierre` en la tabla `documents`.
  - Si el usuario de Balanza existía en `auth.users` pero su perfil aún no figuraba en la tabla pública `public.users`, PostgreSQL rechazaba la transacción por una violación de clave foránea (`fk_encargado_cierre`).
* **Solución**:
  - En [`supabase/functions/compile-and-sign-pdf/index.ts`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/supabase/functions/compile-and-sign-pdf/index.ts), se agregó una comprobación previa de existencia del `supervisorId` en `public.users`.
  - Si el ID no existe en la tabla pública de usuarios, asigna `null` al campo `encargado_cierre` y registra la firma digital limpiamente sin colapsar con error 500.

---

## 3. Bug #3: Tarjetas Grises de Reemplazo ("Pág. X Documento original" / `Object not found`)
* **Síntoma**: Las miniaturas de ciertas páginas (ej: tarjetas 4 a 15 del reporte `#404` / `01-53844`) no renderizaban el canvas y mostraban un rectángulo gris de respaldo.
* **Causa Raíz**:
  - Discrepancias entre las rutas almacenadas en `draft_operations` (con URLs absolutas `https://...` o nombres preliminares de sincronización como `cer-798`) y el nombre real registrado en `file_link` (`01-53844...`).
  - Al fallar la descarga de la hoja por `Object not found`, `pdfDoc` quedaba como `null`.
* **Solución**:
  - Se agregó la función `getCleanPath` para sanitizar y extraer nombres de archivo binarios a partir de URLs HTTP.
  - Se implementó el **Fallback 2 (Autorecuperación por `file_link`)**: si la descarga de una hoja de borrador falla por 404, el visor descarga automáticamente el PDF base desde `file_link` y renderiza la totalidad de las 15 miniaturas de forma fluida.

---

## 4. Bug #4: Clics Múltiples Impulsivos del Usuario (Peticiones Repetidas en Segundos)
* **Síntoma**: Los usuarios presionaban el botón *"Guardar Borrador"* o *"Cerrar por Balanza"* 3 veces en 3 segundos (evidenciado en el historial de auditoría a las 03:13:32, 03:13:49, 03:13:52), enviando peticiones duplicadas a la base de datos.
* **Solución**:
  - En [`src/app/editor/[id]/page.tsx`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/src/app/editor/%5Bid%5D/page.tsx), se aplicó deshabilitación instantánea (`disabled={saving}`) al primer clic.
  - Se integró un icono animado de carga (`Loader2`), cambio de texto a *"Procesando..."* / *"Guardando..."* y cursor `not-allowed`.

---

## 5. Bug #5: Error de Base de Datos `violates check constraint "documents_status_check"` para Estado `OBSERVADO`
* **Síntoma**: Al hacer clic en *"Marcar como Observado"*, PostgreSQL devolvía un error de restricción de validación.
* **Causa Raíz**: La regla `CHECK` en la tabla `documents` de PostgreSQL solo permitía los valores antiguos (`'PENDIENTE'`, `'CERRADO POR BALANZA'`, `'HECHO'`, `'ERROR'`).
* **Solución**:
  - Se actualizó la restricción SQL `documents_status_check` permitiendo el nuevo estado `'OBSERVADO'`.

---

## 6. Bug #6: Mensajes de Error Genéricos `Edge Function returned a non-2xx status code`
* **Síntoma**: Al ocurrir cualquier fallo en el backend, la ventana emergente mostraba un mensaje críptico de Deno en vez de explicar el problema.
* **Solución**:
  - En la invocación de Edge Functions en el cliente, se agregó la extracción del cuerpo JSON de error (`error.context.json()`).
  - Se diseñó el componente **`AlertModal`** (`src/components/ui/Modal.tsx`) en modo oscuro industrial con iconos dinámicos (`CheckCircle` / `AlertCircle`).

---

## 7. Bug #7: Pérdida del Progreso de Navegación y Filtros
* **Síntoma**: Al ingresar a editar un reporte desde ECOGOLD con filtro *"Errores"* y regresar al dashboard, el sistema restablecía la vista a PSAC *"Todos"*.
* **Solución**:
  - Se implementó la transmisión del parámetro `from` en la URL al abrir el editor, garantizando que al presionar regresar o finalizar una acción, el usuario vuelva exactamente a la empresa y filtros que tenía seleccionados.

---

## 🧹 Consultas SQL de Diagnóstico y Reparación Masiva

### A. Diagnóstico General de Reportes Afectados
```sql
SELECT id, name, status, company, file_link, draft_operations
FROM public.documents
WHERE 
  (draft_operations IS NOT NULL AND draft_operations::text LIKE '%signed-%')
  OR (draft_operations IS NOT NULL AND draft_operations::text LIKE '%https://%')
  OR (status IN ('PENDIENTE', 'OBSERVADO', 'ERROR') AND file_link LIKE '%signed-%');
```

### B. Limpieza Masiva de Borradores Viciados en Todo el Sistema
```sql
UPDATE public.documents 
SET draft_operations = NULL
WHERE status IN ('PENDIENTE', 'OBSERVADO', 'ERROR')
  AND (draft_operations::text LIKE '%signed-%' OR draft_operations::text LIKE '%https://%');
```

### C. Actualización de Restricción SQL para Estado OBSERVADO
```sql
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE public.documents ADD CONSTRAINT documents_status_check 
CHECK (status IN ('PENDIENTE', 'CERRADO POR BALANZA', 'OBSERVADO', 'HECHO', 'ERROR'));
```
