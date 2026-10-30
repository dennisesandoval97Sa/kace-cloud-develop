import { useCallback, useMemo, useState } from "react";

export const COMBINED_BULK_ACTIONS_ORDER = ["change_state", "reassign", "close"];

const buildOutcomeResult = (key, outcome) => {
    if (outcome?.skipped) {
        return { key, status: "skipped", processed: 0, total: 0, successIds: [], failedIds: [] };
    }
    const processed = outcome?.processed ?? outcome?.total ?? 0;
    const total = outcome?.total ?? processed;
    return {
        key,
        status: total > 0 && processed < total ? "partial" : "success",
        processed,
        total,
        successIds: outcome?.successIds ?? [],
        failedIds: outcome?.failedIds ?? [],
    };
};

const buildErrorResult = (key, error) => ({
    key,
    status: "error",
    processed: error?.bulkProcessedCount ?? 0,
    total: error?.bulkTotalCount ?? 0,
    successIds: error?.bulkSuccessIds ?? [],
    failedIds: error?.bulkFailedIds ?? [],
    error,
});

/**
 * Envía un paso vía Formik `submitForm()` y lo trata como fallido si quedan
 * errores de validación pendientes (Formik resuelve normalmente en ese caso,
 * sin ejecutar `onSubmit`), para que el orquestador no lo reporte como éxito.
 *
 * Importante: `formikRef.current` se relee DESPUÉS de `submitForm()` (nunca se
 * captura antes) porque Formik reasigna un objeto nuevo en cada render — leer
 * una referencia capturada antes de validar deja `errors` con el valor previo
 * a este intento de envío (típicamente `{}`), ocultando fallos de validación.
 */
export const submitFormikSection = async (formikRef) => {
    if (!formikRef.current) return undefined;
    const outcome = await formikRef.current.submitForm();
    if (Object.keys(formikRef.current?.errors ?? {}).length > 0) {
        throw new Error("validation_failed");
    }
    return outcome;
};

/**
 * Secciones sin checkbox (Cambiar estado, Reasignar) se omiten en silencio si
 * el usuario no llenó nada — solo se validan/ejecutan cuando sí hay intención
 * de usarlas, para no forzar a completar las 3 acciones en cada ejecución.
 */
export const submitOptionalFormikSection = async (formikRef, isEmpty) => {
    const instance = formikRef.current;
    if (!instance || isEmpty(instance.values)) {
        return { skipped: true };
    }
    return submitFormikSection(formikRef);
};

/**
 * Ejecuta, en orden fijo, los pasos habilitados de una acción masiva combinada.
 * Nunca aborta entre pasos: cada paso habilitado se intenta siempre,
 * acumulando un resultado independiente por paso para que la UI pueda
 * mostrar éxito/error por sección sin que uno oculte al otro.
 */
const useCombinedBulkActionsOrchestrator = ({ order = COMBINED_BULK_ACTIONS_ORDER, steps, onAllSettled }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState({});

    const runAll = useCallback(async () => {
        setIsRunning(true);
        setResults({});
        const acc = {};

        for (const key of order) {
            const step = steps[key];
            if (!step?.enabled) {
                acc[key] = { key, status: "skipped", processed: 0, total: 0 };
                setResults({ ...acc });
                continue;
            }

            try {
                const outcome = await step.submit();
                acc[key] = buildOutcomeResult(key, outcome);
            } catch (error) {
                acc[key] = buildErrorResult(key, error);
            }
            setResults({ ...acc });
        }

        setIsRunning(false);
        const allSkipped = Object.values(acc).every((result) => result.status === "skipped");
        onAllSettled?.(acc, { allSkipped });
        return acc;
    }, [order, steps, onAllSettled]);

    const hasAnyFailure = useMemo(
        () => Object.values(results).some((result) => result.status === "error" || result.status === "partial"),
        [results],
    );

    const hasRunAny = Object.keys(results).length > 0;

    const reset = useCallback(() => {
        setResults({});
        setIsRunning(false);
    }, []);

    return { runAll, isRunning, results, hasAnyFailure, hasRunAny, reset };
};

export default useCombinedBulkActionsOrchestrator;
