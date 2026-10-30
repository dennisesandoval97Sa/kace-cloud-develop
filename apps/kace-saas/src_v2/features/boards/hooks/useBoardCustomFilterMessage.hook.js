import { useEffect } from "react";
import { ONESCRIPT_KONECTA_CLOUD } from "@/utils/URL";

/**
 * Escucha el payload `boardFilterData` que emite el formulario de OneScript del
 * filtro personalizado de un tablero.
 *
 * En el acordeon del modulo de agente hay un modal montado por cada tablero
 * expandido y todos escuchan el mismo evento de `window`, asi que el mensaje
 * solo lo aplica la instancia cuyo propio iframe lo emitio; de lo contrario un
 * filtro se propagaria a tableros donde ni siquiera existen esos campos.
 */
const useBoardCustomFilterMessage = (iframeRef, onFilter, enabled = true) => {
    useEffect(() => {
        if (!enabled) return undefined;

        const handleMessage = (event) => {
            if (event.origin !== ONESCRIPT_KONECTA_CLOUD) return;
            const { type, payload } = event.data ?? {};
            if (type !== "boardFilterData" || !Array.isArray(payload)) return;

            const ownWindow = iframeRef?.current?.contentWindow;
            if (!ownWindow || event.source !== ownWindow) return;

            onFilter(payload);
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [iframeRef, onFilter, enabled]);
};

export default useBoardCustomFilterMessage;
