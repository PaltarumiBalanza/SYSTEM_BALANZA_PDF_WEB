export type AuditActionSeverity = 'info' | 'success' | 'warning' | 'danger';

export interface AuditActionPresentation {
    label: string;
    description: string;
    module: string;
    severity: AuditActionSeverity;
}

const ACTION_PRESENTATIONS: Record<string, AuditActionPresentation> = {
    CREATE: {
        label: 'Reporte preliminar registrado',
        description: 'subió un nuevo reporte',
        module: 'Carga',
        severity: 'info'
    },
    UPDATE: {
        label: 'Borrador del reporte actualizado',
        description: 'guardó cambios en las páginas o anexos del reporte',
        module: 'Editor',
        severity: 'info'
    },
    CLOSE_BALANZA: {
        label: 'Cerrado por Balanza',
        description: 'cerró y firmó el reporte por Balanza',
        module: 'Cierre Balanza',
        severity: 'success'
    },
    CLOSE: {
        label: 'Aprobado por Comercial',
        description: 'aprobó el reporte y lo marcó como completado',
        module: 'Aprobación Comercial',
        severity: 'success'
    },
    OBSERVED: {
        label: 'Marcado como observado',
        description: 'marcó el reporte como observado',
        module: 'Control de estado',
        severity: 'warning'
    },
    ERROR_MARKED: {
        label: 'Marcado como error',
        description: 'marcó el reporte como error',
        module: 'Control de estado',
        severity: 'danger'
    },
    DELETE: {
        label: 'Reporte eliminado',
        description: 'eliminó el reporte',
        module: 'Administración',
        severity: 'danger'
    }
};

export function getAuditActionPresentation(action: string | null | undefined): AuditActionPresentation {
    const normalizedAction = action?.trim() || '';
    const knownAction = ACTION_PRESENTATIONS[normalizedAction];
    if (knownAction) return knownAction;

    if (normalizedAction.startsWith('RENAME:')) {
        const renameDetail = normalizedAction.slice('RENAME:'.length).trim();
        return {
            label: renameDetail ? `Reporte renombrado: ${renameDetail}` : 'Reporte renombrado',
            description: renameDetail ? `renombró el reporte (${renameDetail})` : 'renombró el reporte',
            module: 'Administración',
            severity: 'info'
        };
    }

    return {
        label: normalizedAction
            ? `Acción no reconocida (${normalizedAction})`
            : 'Acción sin código',
        description: normalizedAction
            ? `realizó una acción no reconocida (${normalizedAction}) sobre el reporte`
            : 'realizó una acción sin código sobre el reporte',
        module: 'Sin clasificar',
        severity: 'warning'
    };
}
