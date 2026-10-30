import { useCallback, useRef } from "react";

export const useInfiniteScrollGate = () => {
    const armedRef = useRef(false);

    const arm = useCallback(() => {
        armedRef.current = true;
    }, []);

    const reset = useCallback(() => {
        armedRef.current = false;
    }, []);

    const consume = useCallback(() => {
        if (!armedRef.current) return false;
        armedRef.current = false;
        return true;
    }, []);

    return { arm, reset, consume };
};
