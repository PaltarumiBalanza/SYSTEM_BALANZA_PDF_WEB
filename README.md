# SYSTEM_BALANZA_PDF_WEB — Gestor de Reportes de Balanza

Sistema web centralizado para la recepción, edición visual, auditoría, aprobación y descarga masiva de reportes PDF de pesaje minero para las empresas **PSAC** y **ECOGOLD** de Paltarumi SAC.

---

## 🌟 Características Principales

- **Flujo de Trabajo Multitol (RBAC)**:
  - **Balanza (`VIEWER`)**: Revisa borradores, compila y firma (`Cerrar por Balanza`) o señala discrepancias (`Marcar como Observado`).
  - **Área Comercial (`EDITOR`)**: Acceso directo a Descarga Masiva con todos los estados y filtros. Revisa reportes `CERRADO POR BALANZA` para aprobarlos (`Marcar como Completado`) o rechazarlos (`Marcar como Error`).
  - **Administrador (`ADMIN`)**: Control total del sistema, gestión de usuarios, trazabilidad completa y métricas.
- **Editor Visual Interactivo**:
  - Reordenamiento Drag & Drop de páginas.
  - Eliminación de hojas redundantes.
  - Concatenación de anexos PDF.
  - Visor nítido hoja por hoja (modo lector tipo Adobe / Lightbox).
  - Preservación de nombres con espacios reales (`01-E6080 oro negro.pdf`).
- **Estados de Documento**:
  - `PENDIENTE`: Reporte preliminar recién subido desde el software de escritorio.
  - `CERRADO POR BALANZA`: Auditado, compilado y sellado por el equipo de Balanza.
  - `OBSERVADO`: Marcado por Balanza con observaciones pendientes.
  - `HECHO`: Aprobado y finalizado por Comercial (completamente inmutable / solo lectura).
  - `ERROR`: Invalidado por falla de consistencia.
- **Módulo de Auditoría**:
  - Trazabilidad completa por documento y por usuario.
  - Columna **Última modificación por** en paneles PSAC/ECOGOLD (derivada de `audit_documents`).
  - Descarga masiva comprimida en paquete ZIP con filtros por estado, empresa y región.
  - Métricas de control y logs de actividad.
- **Nomenclatura de Archivos**:
  - Preservación de nombres originales del software de escritorio (espacios incluidos, ej: `34 pato.pdf`).
  - Renombrado seguro en todos los estados, incluido `CERRADO POR BALANZA`.

---

## 🛠️ Tecnologías

- **Frontend**: Next.js 16 (App Router), TypeScript, CSS Modules nativos, PDF.js (`pdfjs-dist`), JSZip.
- **Backend & Cloud**: Supabase (PostgreSQL DB, Storage buckets `raw-reports` / `final-reports` / `annex-attachments`, Deno Edge Functions).

---

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build
```

Para más detalles, consulta la [Documentación Técnica](docs/DOCUMENTACION_TECNICA.md), el [Historial de Bugs y Correcciones](docs/HISTORIAL_BUGS_Y_CORRECCIONES.md) y la [Skill de Agente AI (`balanza-pdf-workflow`)](.gemini/skills/balanza-pdf-workflow/SKILL.md).

