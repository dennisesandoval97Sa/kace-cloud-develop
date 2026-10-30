import PropTypes from "prop-types";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { GeneralLoader } from "../../ui-shared";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setIsRefrech, setStates } from "../../../redux/state/states";
import { GeolocationTypes } from "../../../enums/GeolocationTypes";
import useGeolocation from "@kace/hooks/useGeolocation";
import { ONESCRIPT_KONECTA_CLOUD } from "../../../utils/URL";
import { useQueryClient } from "@tanstack/react-query";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { toast } from "sonner";
import useAllowedConnections from "../../../hooks/useAllowedConnections";
import { useNavigationBlocker } from "../../../context/NavigationBlockerContext";
import useConfigAgentData from "../../../hooks/useConfigAgentData";
import useBoardCaseReturn from "@kace_v2/features/boards/hooks/useBoardCaseReturn.hook";

const TAB_CLOSE_COUNTDOWN_START = 5;

const isWindowOpenedByScript = () => {
    if (typeof window === "undefined") {
        return false;
    }
    try {
        const o = window.opener;
        return o != null && !o.closed;
    } catch {
        return false;
    }
};

const toastFromJson = (config) => {
    const {
        type = "info",
        title,
        description,
        duration = 3000,
        position = "bottom-right",
        action,
        cancel,
        closeButton = true,
        className,
        style,
    } = config;

    const VALID_TYPES = new Set(["normal", "action", "success", "info", "warning", "error", "loading", "default"]);

    const toastType = VALID_TYPES.has(type) ? type : "default";

    toast[toastType](title, {
        description,
        duration,
        position,
        className,
        style,
        action,
        cancel,
        closeButton,
    });
};

export const FormOneScript = ({
    formRef,
    url,
    handlerCloseModal = () => {},
    isCaseUpdate = false,
    enableBoardReturn = false,
}) => {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(true);
    const [retryCount, setRetryCount] = useState(0);
    const iframeRef = useRef(null);
    const navigation = useNavigate();
    const dispatchRedux = useDispatch();
    const { handleGeolocation } = useGeolocation();
    const behavior = isCaseUpdate ? GeolocationTypes.CASE_UPDATE : GeolocationTypes.CASE_CREATION;
    const hasLoggedGeolocationRef = useRef(false);
    const queryClient = useQueryClient();
    const { disableBlocker } = useNavigationBlocker();
    const { cases: configCases } = useConfigAgentData();
    const resolveBoardReturnRoute = useBoardCaseReturn();

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;

    const handleIframeLoad = () => {
        setIsLoading(false);
    };

    const handleIframeError = () => {
        if (retryCount < MAX_RETRIES) {
            setTimeout(() => {
                setRetryCount(retryCount + 1);
                iframeRef.current.src = url;
            }, RETRY_DELAY);
        } else {
            setIsLoading(false);
            toast.error("Error al cargar el formulario");
        }
    };

    useEffect(() => {
        if (iframeRef.current) {
            iframeRef.current.src = url;
        }
        hasLoggedGeolocationRef.current = false;
    }, [url, retryCount]);

    const [routeToCheck, setRouteToCheck] = useState(null);
    const { isAllowed, isLoading: isLoadingPermissions, error } = useAllowedConnections(routeToCheck);

    const shouldCloseTab = configCases?.close_tab_on_case_created ?? false;

    const [tabCloseCountdown, setTabCloseCountdown] = useState(null);

    const performKaceTabClose = useCallback(() => {
        disableBlocker();
        const hostClose = window.__kace_closeCurrentWindow;
        if (typeof hostClose === "function") {
            hostClose();
            return;
        }
        window.close();
    }, [disableBlocker]);

    useEffect(() => {
        if (tabCloseCountdown === null) {
            return undefined;
        }
        if (tabCloseCountdown <= 0) {
            performKaceTabClose();
            setTabCloseCountdown(null);
            return undefined;
        }
        const id = setTimeout(() => {
            setTabCloseCountdown((c) => (c === null ? null : c - 1));
        }, 1000);
        return () => clearTimeout(id);
    }, [tabCloseCountdown, performKaceTabClose]);

    const startTabCloseCountdown = useCallback(() => {
        setTabCloseCountdown(TAB_CLOSE_COUNTDOWN_START);
    }, []);

    const navigateToRoute = (route) => {
        const isRelativePath = route.startsWith("/");
        if (isRelativePath) {
            navigation(route, { replace: true });
        } else {
            window.location.href = route;
        }
    };

    useEffect(() => {
        if (!routeToCheck) return;

        if (isLoadingPermissions) {
            toast.info("Verificando permisos...");
            return;
        }

        if (error) {
            toast.error("Error al validar la ruta");
            return;
        }

        if (!isAllowed) {
            toast.error("No tienes permisos para acceder a esta URL");
            return;
        }

        navigateToRoute(routeToCheck);
        setRouteToCheck(null);
    }, [routeToCheck, isAllowed, isLoadingPermissions, error, navigation]);

    useEffect(() => {
        const handleMessage = (event) => {
            if (event.origin !== ONESCRIPT_KONECTA_CLOUD) return;
            if (event.source !== iframeRef.current?.contentWindow) return;
            const { route, toastConfig, type } = event.data;

            const isMBIFRAME = typeof type === "string" && type.includes("MB_IFRAME");

            if (
                type === "userFormData" ||
                type === "groupFormData" ||
                type === "KACE_ONE_SCRIPT_INTERACTION" ||
                type === "boardFilterData" ||
                type === "ONECSCRIPT_UPDATE_GROUP" ||
                type === "KACE_INIT_REQUEST" ||
                type === "kaceCreateCase" ||
                isMBIFRAME
            )
                return;

            if (type === "ONESCRIPT_GO_BACK") {
                navigation(-1);
            }
            if (type === "advancedSearch" && route) {
                navigateToRoute(route);
                handlerCloseModal();
                return;
            }

            if (shouldCloseTab && isWindowOpenedByScript()) {
                startTabCloseCountdown();
                return;
            }

            if (route) {
                const isSameOrigin = route.startsWith(window.location.origin);
                const isRelativePath = route.startsWith("/");

                const boardReturnRoute = resolveBoardReturnRoute(route);
                const isFromThisIframe = event.source != null && event.source === iframeRef.current?.contentWindow;

                disableBlocker();

                if (boardReturnRoute) {
                    /*
                     * En la pagina del caso hay varias instancias de FormOneScript montadas a la
                     * vez (caso, cliente, notificaciones) y todas escuchan el mismo mensaje, asi
                     * que la decision debe ser uniforme: ninguna navega al caso, porque eso
                     * anularia el retorno de la instancia propietaria. Solo vuelve al tablero la
                     * instancia del formulario del caso (`enableBoardReturn`) cuyo propio iframe
                     * emitio el mensaje; asi un guardado en cliente o notificaciones no expulsa
                     * al agente del formulario que esta editando.
                     */
                    if (enableBoardReturn && isFromThisIframe) navigateToRoute(boardReturnRoute);
                } else if (!isSameOrigin && !isRelativePath) {
                    setRouteToCheck(route);
                } else {
                    navigateToRoute(route);
                }
            }

            queryClient.invalidateQueries([URL_AND_KEYS.cases.byCaseId, URL_AND_KEYS.cases.keyAdminCase]);
            dispatchRedux(setStates([]));
            dispatchRedux(setIsRefrech(true));
            if (!hasLoggedGeolocationRef.current) {
                hasLoggedGeolocationRef.current = true;
                handleGeolocation(behavior.value, 10000);
            }

            if (toastConfig) {
                toastFromJson(toastConfig);
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [
        navigation,
        dispatchRedux,
        queryClient,
        handleGeolocation,
        behavior,
        disableBlocker,
        startTabCloseCountdown,
        handlerCloseModal,
        configCases,
        resolveBoardReturnRoute,
        enableBoardReturn,
    ]);

    const tabCloseOverlay =
        tabCloseCountdown !== null &&
        typeof document !== "undefined" &&
        createPortal(
            <div
                className="fixed inset-0 z-[9999] flex min-h-[100dvh] w-screen max-w-none flex-col items-center justify-center gap-4 overflow-hidden bg-black/80 px-6 text-center text-white touch-none"
                role="alertdialog"
                aria-modal="true"
                aria-live="assertive"
                data-testid="form_onescript_tab_close_countdown"
            >
                <p className="max-w-md text-base font-medium sm:text-lg">{t("case.text.tabCloseDescription")}</p>
                {tabCloseCountdown > 0 ? (
                    <>
                        <p className="text-sm text-white/90">{t("case.text.tabCloseTimeRemaining")}</p>
                        <p
                            className="text-6xl font-bold tabular-nums sm:text-7xl"
                            aria-label={t("case.text.tabCloseSecondsAria", { count: tabCloseCountdown })}
                        >
                            {tabCloseCountdown}
                        </p>
                        <p className="text-sm text-white/80">{t("case.text.tabCloseSeconds")}</p>
                    </>
                ) : (
                    <p className="text-lg font-semibold">{t("case.text.tabCloseClosing")}</p>
                )}
            </div>,
            document.body,
        );

    return (
        <>
            {tabCloseOverlay}
            {isLoading && (
                <div className="absolute border-none w-full justify-center items-center flex flex-col">
                    <GeneralLoader className="" id="form_loading_onescript" data-testid="form_loading_onescript" />
                    <p>Cargando Formulario</p>
                </div>
            )}
            <iframe
                ref={(el) => {
                    iframeRef.current = el;
                    if (formRef) {
                        formRef.current = el;
                    }
                }}
                src={url}
                className="absolute inset-0 w-full h-full border-none"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                id="form_onescript_iframe"
                data-testid="form_onescript_iframe"
                allow="microphone"
            ></iframe>
        </>
    );
};

FormOneScript.propTypes = {
    formRef: PropTypes.object.isRequired,
    url: PropTypes.string.isRequired,
    setIsNewClient: PropTypes.func,
    handlerCloseModal: PropTypes.func,
    clientId: PropTypes.string,
    isCaseUpdate: PropTypes.bool,
    enableBoardReturn: PropTypes.bool,
};
