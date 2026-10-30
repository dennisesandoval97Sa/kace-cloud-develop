import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { apiService } from "@kace/utils";
import { useTranslation } from "react-i18next";
import { FOLIO_CONFIGURATIONS_SERVICE } from "@/utils/main";
import { isPreviewable } from "../utils/segments";

/**
 * Shows what the current configuration would produce.
 *
 * The endpoint READS the counter and renders `current + 1`; it never reserves. Reserving
 * for a preview would burn a consecutive number every time an administrator opened this
 * screen.
 *
 * Field segments need sample values, so the caller supplies a small context shaped like
 * the case context (`{ cases, aux_cases, clasificaciones }`).
 *
 * When editing a saved configuration the caller passes its id: the draft still gives the
 * layout, and the id points the endpoint at that configuration's counter, so the preview
 * shows the real next folio instead of start_value.
 */
/*
 * Stable identity for the default. An inline `{}` would be a new object on every render,
 * which would invalidate the memo below and reschedule the debounce on every state update —
 * and since refreshing sets state, that is an endless loop of preview requests.
 */
const EMPTY_CONTEXT = {};

const FolioPreview = ({
    configurationId,
    segments,
    resetPolicy,
    startValue,
    overflowPolicy,
    context = EMPTY_CONTEXT,
}) => {
    const { t } = useTranslation();
    const [folio, setFolio] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    /*
     * Id of the latest request. A slower, older response must not overwrite the preview of
     * the current draft nor switch off its loading state, so each one checks it still owns it.
     */
    const latestRequest = useRef(0);

    /*
     * Keyed by value, not by reference, so the debounce survives a caller that rebuilds
     * `segments` or `context` inline on each render.
     */
    const payload = useMemo(
        () => ({
            ...(configurationId ? { id: configurationId } : {}),
            segments: segments ?? [],
            reset_policy: resetPolicy,
            start_value: startValue,
            overflow_policy: overflowPolicy,
            context: context ?? EMPTY_CONTEXT,
        }),
        [
            configurationId,
            JSON.stringify(segments ?? []),
            resetPolicy,
            startValue,
            overflowPolicy,
            JSON.stringify(context ?? EMPTY_CONTEXT),
        ],
    );

    const refresh = useCallback(async () => {
        const requestId = ++latestRequest.current;
        const isCurrent = () => requestId === latestRequest.current;

        /*
         * A row the user is still filling in would come back as a 400 naming a segment that
         * is simply not finished yet, so wait until the draft is something the API accepts.
         */
        if (!isPreviewable(payload.segments)) {
            setFolio(null);
            setError(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await apiService.post(`${FOLIO_CONFIGURATIONS_SERVICE}/preview`, payload);
            if (!isCurrent()) return;
            setFolio(response?.data?.data?.folio ?? response?.data?.folio ?? null);
            setError(null);
        } catch (e) {
            if (!isCurrent()) return;
            setFolio(null);
            /*
             * The message names the offending segment, which is the useful part while editing.
             * In production the API swaps the 4xx message for a generic one and sends the domain's in data.detail.
             */
            const body = e?.response?.data;
            setError(body?.data?.detail ?? body?.message ?? t("folioConfigurations.preview.error"));
        } finally {
            if (isCurrent()) setLoading(false);
        }
    }, [payload, t]);

    useEffect(() => {
        const timer = setTimeout(refresh, 400);
        return () => {
            clearTimeout(timer);
            // Orphans any request still in flight: a new draft is coming, or the screen is gone.
            latestRequest.current += 1;
        };
    }, [refresh]);

    return (
        <div className="rounded-md border border-border p-4" data-testid="folio_preview">
            <p className="text-xs text-muted-foreground">{t("folioConfigurations.preview.title")}</p>

            {loading && <p className="text-sm">{t("folioConfigurations.preview.loading")}</p>}

            {!loading && folio && (
                <p className="font-mono text-2xl tracking-wider" data-testid="folio_preview_value">
                    {folio}
                </p>
            )}

            {!loading && error && (
                <p className="text-sm text-destructive" role="alert" data-testid="folio_preview_error">
                    {error}
                </p>
            )}

            <p className="mt-2 text-xs text-muted-foreground">{t("folioConfigurations.preview.hint")}</p>
        </div>
    );
};

FolioPreview.propTypes = {
    configurationId: PropTypes.string,
    segments: PropTypes.array,
    resetPolicy: PropTypes.string,
    startValue: PropTypes.number,
    overflowPolicy: PropTypes.string,
    context: PropTypes.object,
};

export default FolioPreview;
