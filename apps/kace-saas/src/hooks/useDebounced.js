import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

const useDebounced = (callback, delay, { flushOnUnmount = false } = {}) => {
    const timeoutRef = useRef(null);
    const pendingArgsRef = useRef(null);
    const callbackRef = useRef(callback);
    const flushOnUnmountRef = useRef(flushOnUnmount);

    // Stable identity across renders; the pending call still runs the latest callback.
    useLayoutEffect(() => {
        callbackRef.current = callback;
        flushOnUnmountRef.current = flushOnUnmount;
    });

    const debouncedFn = useMemo(() => {
        const cancel = () => {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
            pendingArgsRef.current = null;
        };

        const flush = () => {
            const pendingArgs = pendingArgsRef.current;
            if (pendingArgs === null) return;

            cancel();
            callbackRef.current(...pendingArgs);
        };

        const debouncedFn = (...args) => {
            clearTimeout(timeoutRef.current);
            pendingArgsRef.current = args;
            timeoutRef.current = setTimeout(flush, delay);
        };

        debouncedFn.cancel = cancel;
        debouncedFn.flush = flush;

        return debouncedFn;
    }, [delay]);

    useEffect(
        () => () => {
            if (flushOnUnmountRef.current) {
                debouncedFn.flush();
            } else {
                debouncedFn.cancel();
            }
        },
        [debouncedFn],
    );

    return debouncedFn;
};

export default useDebounced;
