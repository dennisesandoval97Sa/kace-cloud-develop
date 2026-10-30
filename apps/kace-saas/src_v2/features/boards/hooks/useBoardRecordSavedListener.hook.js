import { useEffect } from "react";
import { ONESCRIPT_KONECTA_CLOUD } from "@/utils/URL";

const useBoardRecordSavedListener = (setSelectedEntity) => {
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.origin !== ONESCRIPT_KONECTA_CLOUD) return;
            const { type, entity_id } = event.data ?? {};
            if (type !== "KACE_BOARD_RECORD_SAVED" || !entity_id) return;
            setSelectedEntity(entity_id);
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [setSelectedEntity]);
};

export default useBoardRecordSavedListener;
