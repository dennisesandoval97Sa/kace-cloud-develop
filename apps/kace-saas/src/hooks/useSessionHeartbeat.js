import { useEffect, useRef } from "react";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { apiService } from "@/utils/main";

const envHeartBeatFrequency = parseInt(import.meta.env.VITE_SESSION_HEARTBEAT_FREQUENCY, 10);
const envHeartBeatDisable = import.meta.env.VITE_SESSION_HEARTBEAT_DISABLE === "true";
const pollingInterval = isNaN(envHeartBeatFrequency) ? 60000 : envHeartBeatFrequency;

const useSessionHeartbeat = () => {
    const isPollingRef = useRef(false);

    useEffect(() => {
        if(envHeartBeatDisable) return;

        const sendHeartbeat = async () => {
            if (isPollingRef.current) return;
            isPollingRef.current = true;
            try {
                await apiService.post(
                    URL_AND_KEYS.heartbeat.url,
                    {
                        user_id: localStorage.getItem("userId") ?? null,
                    },
                );
            } finally {
                isPollingRef.current = false;
            }
        };

        const initialCallTimeout = setTimeout(sendHeartbeat, 0);

        const intervalId = setInterval(() => {
            sendHeartbeat();
        }, pollingInterval);

        return () => {
            clearTimeout(initialCallTimeout);
            clearInterval(intervalId);
        };
    }, []);
};

export default useSessionHeartbeat;
