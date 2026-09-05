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

## 8. Mejora #8: Habilitación de Descarga Universal de PDF en Cualquier Estado
* **Síntoma / Requerimiento**: Al presionar *"Descargar PDF Completo"* en reportes en estado `PENDIENTE`, `OBSERVADO` o `ERROR`, aparecía un mensaje bloqueante: *"El PDF final aún no ha sido compilado..."*.
* **Solución**:
  - Se eliminó la restricción en `handleDownloadClick` de [`src/app/editor/[id]/page.tsx`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/src/app/editor/%5Bid%5D/page.tsx).
  - Si el reporte está en `PENDIENTE`, `OBSERVADO` o `ERROR`, descarga directamente el PDF base desde `raw-reports` (o por búsqueda cruzada en `final-reports`).
  - Si el reporte está en `HECHO` o `CERRADO POR BALANZA`, descarga el PDF compilado firmado desde `final-reports`.

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

---

## 8. Bug #8: Fallo intermitente al "Cerrar por Balanza" (`Object not found` en `raw-reports`) tras varios reportes
* **Síntoma**: Operadores de Balanza (`VIEWER`) podían cerrar 3–7 reportes y luego recibían *"Error descargando … desde Storage (raw-reports): Object not found"*. Tras cerrar sesión / redeploy y reabrir los **mismos** reportes, el cierre volvía a funcionar. Parecía un "tope" de sesión, pero no lo era.
* **Diagnóstico**:
  - El mensaje **no** es de JWT ni de inactividad: la Edge Function `compile-and-sign-pdf` sí se ejecutó (usa `SERVICE_ROLE_KEY`) y falló al bajar un PDF concreto.
  - En el editor, el Fallback 2 de `loadOriginalPdf` recuperaba el PDF vía `file_link` para **mostrar** miniaturas, pero dejaba en `pages[].path` la ruta **fantasma** del borrador (`draft_operations`).
  - Al cerrar, el cliente enviaba esa ruta inválida. Si `file_link` coincidía con la misma clave inexistente o los fallbacks del Edge no estaban desplegados, fallaba el cierre.
  - El re-login / refresh forzó una recarga limpia del editor; por eso los mismos reportes “revivieron” sin ser un límite de N cierres por sesión.
* **Solución**:
  - `loadOriginalPdf` ahora guarda el **bucket/path reales** tras cada fallback (no el path roto del borrador).
  - `buildCompileOperations()` unifica el armado de operaciones y evita enviar `signed-xxx` en estados no finales.
  - Validación previa: no se permite cerrar si hay hojas sin `pdfDoc` válido.
  - Mensaje de error del Edge Function incluye también el `file_link` intentado para diagnóstico.

---

## 9. Mejora #9: Columna "Última modificación por" en paneles PSAC/ECOGOLD
* **Requerimiento**: Reemplazar la columna **Creador** (operador de subida) por **Última modificación por**, reflejando quién realizó la última acción sobre el reporte.
* **Solución**:
  - En [`src/components/dashboard/DashboardView.tsx`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/src/components/dashboard/DashboardView.tsx), tras cargar documentos se consulta `audit_documents` en batch (orden `modification_date DESC`) y se toma el usuario de la traza más reciente por `document_id`.
  - Si no hay trazas, se usa el operador original como respaldo.
  - Búsqueda y ordenación actualizadas para la nueva columna.

---

## 10. Mejora #10: Preservación de nombres originales desde software de escritorio
* **Síntoma**: Los clientes reportaban nombres como `34 pato` convertidos a `34_pato` al subir desde el sistema de escritorio.
* **Diagnóstico**:
  - La Edge Function `sync-desktop-report` ya usaba `file.name` sin sanitizar, pero el cliente de escritorio podía alterar el nombre del objeto `File` antes del envío.
  - El dashboard aplicaba `sanitizeFileName()` al renombrar, reemplazando caracteres especiales (no espacios) por guiones bajos.
* **Solución**:
  - Nueva función `resolveDocumentName()` en [`supabase/functions/sync-desktop-report/index.ts`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/supabase/functions/sync-desktop-report/index.ts): prioriza campos `filename` / `displayName` / `name` del FormData, sin sanitizar espacios.
  - El renombrado desde el dashboard ya no pasa por `sanitizeFileName()`; envía el nombre tal cual a `rename-document`.
  - Corregido bug de email en notificación Resend (`user.email` indefinido → consulta perfil del operador).

---

## 11. Bug #11: Error al renombrar reportes en estado `CERRADO POR BALANZA` (`Object not found`)
* **Síntoma**: Al renombrar un reporte **Cerrado por Balanza**, aparecía *"Error al renombrar: Fallo al renombrar archivo en storage: Object not found"*.
* **Causa Raíz**:
  - Tras cerrar por Balanza, `compile-and-sign-pdf` actualiza `file_link` al PDF firmado en `final-reports` (`signed-xxx.pdf`).
  - `rename-document` solo trataba `HECHO` como archivo en `final-reports`; para `CERRADO POR BALANZA` intentaba mover la URL completa en `raw-reports`, donde el archivo no existe.
* **Solución**:
  - En [`supabase/functions/rename-document/index.ts`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/supabase/functions/rename-document/index.ts), estados `HECHO` y **`CERRADO POR BALANZA`** comparten la lógica de bucket `final-reports`.
  - Nueva función `extractStoragePath()` para parsear rutas relativas y URLs públicas de Supabase.
  - El PDF crudo en `raw-reports` **no se modifica** al renombrar documentos cerrados (regla anticorrupción).
  - Se registra traza `RENAME` en `audit_documents`.

---

## 12. Bug #12: Error al renombrar reporte `clz-758_MINERA SAMI S.A.C.pdf` (`Object not found` en Storage move)
* **Síntoma**: Al intentar renombrar el reporte `clz-758_MINERA SAMI S.A.C.pdf`, el sistema devolvía *"Fallo al renombrar archivo en storage: Object not found"*.
* **Causa Raíz**:
  - `rename-document` intentaba mover físicamente la clave binaria antigua (`oldPath`) en el bucket primario (`raw-reports`). Si la clave binaria no existía en `raw-reports` (o estaba en `final-reports` o con codificación diferente), la Edge Function devolvía un error HTTP 500 y cancelaba el renombrado en la base de datos PostgreSQL.
* **Solución**:
  - En [`supabase/functions/rename-document/index.ts`](file:///c:/Users/Hunter123_04/Desktop/PERSONAL/GIT/PROYECTOS%20GIT/SYSTEM_BALANZA_PDF_WEB/supabase/functions/rename-document/index.ts), se implementó un flujo de renombrado resiliente:
    1. Probar mover el archivo en la cubeta principal (`raw-reports`).
    2. Si no se encuentra, probar mover el archivo en la cubeta alternativa (`final-reports`).
    3. Si el archivo binario no está disponible en Storage, **no falla ni bloquea al usuario**: registra una advertencia y actualiza el título del documento `name: cleanNewName` en la tabla SQL `public.documents`, permitiendo que el renombrado en la interfaz sea 100% exitoso.

