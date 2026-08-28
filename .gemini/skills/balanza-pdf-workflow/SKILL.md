---
name: balanza-pdf-workflow
description: >
  Guía y protocolo técnico para la gestión de reportes de balanza en Paltarumi SAC.
  Utilizar cuando el usuario solicite editar reportes, corregir duplicación de páginas,
  gestionar estados RBAC (HECHO, CERRADO POR BALANZA, OBSERVADO, ERROR, PENDIENTE),
  configurar la Edge Function compile-and-sign-pdf, renombrar documentos,
  integrar sync-desktop-report con nombres originales, o administrar autenticación/tokens de 6h.
---

# Balanza PDF Workflow & Maintenance Skill

Esta skill condensa la arquitectura, flujo de trabajo, código de colores, prevención de errores y protocolos de depuración para la plataforma web de reportes de balanzas de **Paltarumi SAC**.

## 1. Matriz de Roles y Reglas de Edición (RBAC)

- **`VIEWER` (Operadores de Área de Balanza)**:
  - Pueden previsualizar, reordenar hojas, concatenar anexos en PDF y guardar borradores.
  - Tienen permitido cambiar estado a **`CERRADO POR BALANZA`** (firma digital) y **`OBSERVADO`**.
  - **NO tienen permitido** editar la lista de hojas en reportes `HECHO` o `CERRADO POR BALANZA`.
  - **NO tienen permitido** marcar como `ERROR` (salvo solicitud explícita de administración).

- **`EDITOR` / `SUPERVISOR` (Área Comercial)**:
  - Tienen restringida la edición visual de hojas (drag & drop, adjuntar o eliminar páginas deshabilitados).
  - Su función es revisar y cambiar el estado del reporte a **`HECHO`** (Completado) o **`ERROR`**.

- **`ADMIN` (Administración)**:
  - Permisos totales de lectura, edición, auditoría y gestión de usuarios.

---

## 2. Código de Colores Unificado

| Estado | Color | Código HEX | Estilo Visual |
| :--- | :--- | :--- | :--- |
| **`HECHO`** | Verde | `#10b981` | Botón verde sólido / Badge verde |
| **`CERRADO POR BALANZA`** | Azul | `#3b82f6` | Botón azul sólido / Badge azul |
| **`ERROR`** | Rojo | `#ef4444` | Botón rojo / Badge rojo |
| **`PENDIENTE`** | Ámbar / Amarillo | `#f59e0b` | Badge amarillo |
| **`OBSERVADO`** | Ámbar / Naranja | `#f59e0b` | Badge naranja |

---

## 3. Protocolo Anticorrupción de Archivos PDF (Regla de Oro)

> [!CRITICAL]
> **Carga de Hojas Base**: Al abrir un reporte en estado `PENDIENTE`, `OBSERVADO` o `ERROR`, las páginas base del documento **DEBEN cargarse única y exclusivamente desde el PDF crudo original en `raw-reports`**.

- **NUNCA** sustituir `op.path` por el archivo `signed-xxx.pdf` en `final-reports`.
- Al compilar y firmar con la Edge Function `compile-and-sign-pdf`, siempre se compila el **PDF crudo + anexos**, aplicando 1 solo sello de firma digital.

---

## 4. Fallbacks y Sanitización en el Cargador de PDFs (`loadOriginalPdf`)

1. **`getCleanPath(path)`**: Limpia cualquier URL HTTP/HTTPS dejando únicamente la clave del archivo binario.
2. **Fallback Dual-Bucket**: Si la descarga de un archivo falla en `raw-reports`, busca automáticamente en `final-reports` (o viceversa).
3. **Fallback por `file_link`**: Si la clave del borrador falla por 404, recurre al campo `file_link` registrado en PostgreSQL.

---

## 5. Consultas SQL de Diagnóstico y Mantenimiento

### Detección de Borradores Viciados en el Sistema:
```sql
SELECT id, name, status, company, file_link, draft_operations
FROM public.documents
WHERE 
  (draft_operations IS NOT NULL AND draft_operations::text LIKE '%signed-%')
  OR (draft_operations IS NOT NULL AND draft_operations::text LIKE '%https://%')
  OR (status IN ('PENDIENTE', 'OBSERVADO', 'ERROR') AND file_link LIKE '%signed-%');
```

### Limpieza Masiva de Borradores:
```sql
UPDATE public.documents 
SET draft_operations = NULL
WHERE status IN ('PENDIENTE', 'OBSERVADO', 'ERROR')
  AND (draft_operations::text LIKE '%signed-%' OR draft_operations::text LIKE '%https://%');
```

### Resetear un Documento Específico a PENDIENTE:
```sql
UPDATE public.documents 
SET status = 'PENDIENTE', draft_operations = NULL
WHERE id = <ID_DOCUMENTO>;
```

---

## 6. Dashboard: Columna "Última modificación por"

- Los paneles **PSAC** y **ECOGOLD** (`DashboardView.tsx`) muestran quién realizó la **última acción** según `audit_documents`, no el operador de la subida original.
- Consulta batch: ordenar por `modification_date DESC`, tomar la primera entrada por `document_id`.
- Respaldo: si no hay trazas, usar `documents.user_id`.
- Acciones que actualizan esta columna: `CREATE`, `UPDATE`, `CLOSE_BALANZA`, `CLOSE`, `OBSERVED`, `ERROR_MARKED`, `RENAME: ...`.

---

## 7. Subida desde Escritorio: Preservación de Nombres

- Edge Function: `sync-desktop-report` → función `resolveDocumentName()`.
- **No sanitizar** espacios ni convertir a guiones bajos en `documents.name`.
- Prioridad del nombre: `filename` → `displayName` → `name` (FormData) → `file.name`.
- Path en Storage: `{timestamp}-{nombre}` (prefijo técnico; el nombre visible es `documents.name`).
- Recomendación al cliente de escritorio:
  ```javascript
  formData.append('file', pdfBlob, '34 pato.pdf');
  formData.append('filename', '34 pato.pdf');
  ```

---

## 8. Renombrado Seguro por Estado

| Estado | Bucket | ¿Toca `raw-reports`? |
| :--- | :--- | :--- |
| `PENDIENTE`, `OBSERVADO`, `ERROR` | `raw-reports` | Sí (mueve el crudo) |
| `CERRADO POR BALANZA`, `HECHO` | `final-reports` | **No** (solo mueve el firmado) |

- Edge Function: `rename-document` → `extractStoragePath()` para URLs públicas.
- El dashboard envía el nombre sin `sanitizeFileName()` (espacios permitidos).
- Siempre registrar traza `RENAME` en `audit_documents`.
- Despliegue: `supabase functions deploy rename-document`.
