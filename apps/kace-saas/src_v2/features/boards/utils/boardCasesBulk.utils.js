import { findPublicErrorCode, PUBLIC_ERROR_CODES } from "@kace/error-codes";

export const CASES_BULK_MAX = 500;

export function formatLastSeenAtForFilter(date) {
    const pad = (value, size = 2) => String(Math.abs(Math.trunc(value))).padStart(size, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const millis = pad(date.getMilliseconds(), 3);
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = pad(Math.floor(absOffset / 60));
    const offsetMins = pad(absOffset % 60);
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${millis} ${sign}${offsetHours}${offsetMins}`;
}

export function getBoardColumnValueKey(columns, entity, field) {
    const col = columns?.find((c) => c.entity === entity && c.field === field);
    return col ? col.alias || col.field : null;
}

export function readFechaResolucionFromRow(row, boardColumnKey) {
    const prefer = boardColumnKey ?? "fecha_resolucion";
    const primary = row[prefer];
    if (primary !== undefined) return primary;
    if (prefer !== "fecha_resolucion") {
        return row.fecha_resolucion;
    }
    return undefined;
}

export function readTransicionIdFromRow(row, boardColumnKey) {
    const prefer = boardColumnKey ?? "transicion_id";
    const primary = row[prefer];
    if (primary !== undefined) return primary;
    if (prefer !== "transicion_id") {
        return row.transicion_id;
    }
    return undefined;
}

export function partitionClosedCases(rows, fechaResolucionBoardKey = null) {
    const eligibleRows = [];
    const skippedClosedRows = [];
    for (const row of rows) {
        const v = readFechaResolucionFromRow(row, fechaResolucionBoardKey);
        if (v != null && v !== "") {
            skippedClosedRows.push(row);
        } else {
            eligibleRows.push(row);
        }
    }
    return { eligibleRows, skippedClosedRows };
}

export function partitionClosedByColumnKey(rows, fechaResolucionKey) {
    return partitionClosedCases(rows, fechaResolucionKey || null);
}

export function hasSameTransicion(rows, transicionIdBoardKey = null) {
    if (rows.length <= 1) return true;
    const first = readTransicionIdFromRow(rows[0], transicionIdBoardKey);
    return rows.every((row) => readTransicionIdFromRow(row, transicionIdBoardKey) === first);
}

export function getEligibleCaseIds(selectedRows, fechaResolucionBoardKey = null) {
    const { eligibleRows } = partitionClosedCases(selectedRows, fechaResolucionBoardKey);
    return eligibleRows.map((row) => row.id).filter(Boolean);
}

export function chunkCaseIds(caseIds, max = CASES_BULK_MAX) {
    const chunks = [];
    for (let i = 0; i < caseIds.length; i += max) {
        chunks.push(caseIds.slice(i, i + max));
    }
    return chunks;
}

export async function runCaseBulkChunks(caseIds, postFn, buildPayload) {
    const chunks = chunkCaseIds(caseIds);
    let processedCount = 0;
    const successIds = [];
    const responses = [];
    for (const chunk of chunks) {
        try {
            const resp = await postFn(buildPayload(chunk));
            responses.push(resp);
            processedCount += chunk.length;
            successIds.push(...chunk);
        } catch (err) {
            err.bulkProcessedCount = processedCount;
            err.bulkTotalCount = caseIds.length;
            err.bulkSuccessIds = successIds;
            err.bulkFailedIds = caseIds.filter((id) => !successIds.includes(id));
            err.bulkResponses = responses;
            throw err;
        }
    }
    return { processedCount, successIds, responses };
}

export function parseBulkAssignResponses(responses, totalCases = 0) {
    let totalSkipped = 0;
    let totalAssigned = 0;
    let hasAssignedCount = false;
    let isPartial = false;
    const allSkippedIds = [];

    for (const resp of responses || []) {
        const resBody = resp?.data;
        const metadata = resBody?.metadata ?? resBody?.data?.metadata;
        const code = resBody?.code ?? resBody?.data?.code;
        if (metadata?.skippedCount > 0) {
            totalSkipped += metadata.skippedCount;
            isPartial = true;
        }
        if (Array.isArray(metadata?.skippedIds)) {
            allSkippedIds.push(...metadata.skippedIds);
        }
        if (typeof metadata?.assignedCount === "number") {
            totalAssigned += metadata.assignedCount;
            hasAssignedCount = true;
        }
        if (code === PUBLIC_ERROR_CODES.CASE_BULK_ASSIGNMENT_PARTIAL) {
            isPartial = true;
        }
    }

    const assigned = hasAssignedCount ? totalAssigned : Math.max(0, totalCases - totalSkipped);

    return {
        totalSkipped,
        totalAssigned: assigned,
        isPartial: isPartial && totalSkipped > 0,
        allSkippedIds,
    };
}

export function resolveBulkOutcomeIds(caseIds, successIds, assigned, allSkippedIds = []) {
    if (assigned === 0) {
        return {
            successIds: [],
            failedIds: caseIds,
        };
    }
    if (allSkippedIds.length > 0) {
        const resolvedSuccess = successIds.filter((id) => !allSkippedIds.includes(id));
        return {
            successIds: resolvedSuccess,
            failedIds: allSkippedIds,
        };
    }
    const resolvedSuccess = successIds.slice(0, assigned);
    return {
        successIds: resolvedSuccess,
        failedIds: caseIds.filter((id) => !resolvedSuccess.includes(id)),
    };
}

const BULK_PERMISSION_KEYS = {
    boardsUpdateRegister: "boards.bulkActions.permissionBoardsUpdateRegister",
    casesBulkAssign: "boards.bulkActions.permissionCasesBulkAssign",
    casesBulkTransition: "boards.bulkActions.permissionCasesBulkTransition",
    casesBulkClose: "boards.bulkActions.permissionCasesBulkClose",
};

export const resolveBoardBulkCapabilities = ({
    canUpdateBoardRegister,
    canBulkClose,
    canBulkTransition,
    canBulkAssign,
}) => {
    const canReassign = canUpdateBoardRegister && canBulkAssign;
    const canChangeState = canUpdateBoardRegister && canBulkTransition;
    const canClose = canUpdateBoardRegister && canBulkClose;
    const hasAnyAction = canReassign || canChangeState || canClose;

    const missingPermissionKeys = hasAnyAction
        ? []
        : [
              !canUpdateBoardRegister && BULK_PERMISSION_KEYS.boardsUpdateRegister,
              !canBulkAssign && BULK_PERMISSION_KEYS.casesBulkAssign,
              !canBulkTransition && BULK_PERMISSION_KEYS.casesBulkTransition,
              !canBulkClose && BULK_PERMISSION_KEYS.casesBulkClose,
          ].filter(Boolean);

    return { canReassign, canChangeState, canClose, missingPermissionKeys };
};

export function isResponsibleUnavailableError(error, translated, t) {
    const code = findPublicErrorCode(error?.response?.data?.data?.code, error?.response?.data?.code);
    return (
        code === PUBLIC_ERROR_CODES.CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE ||
        translated === t("boards.bulkActions.apiErrors.couldNotAssignResponsible") ||
        translated === t("app.errors.public.CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE")
    );
}
