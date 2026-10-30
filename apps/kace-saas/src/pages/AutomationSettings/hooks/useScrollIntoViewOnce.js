import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Scrolls a node into view once per mount, on demand.
 * `isDisabled` suppresses it entirely (e.g. read-only views).
 */
const useScrollIntoViewOnce = ({ isDisabled = false } = {}) => {
    const ref = useRef(null);
    const hasScrolledRef = useRef(false);
    const [shouldScroll, setShouldScroll] = useState(false);

    const request = useCallback(() => {
        if (isDisabled || hasScrolledRef.current) return;
        hasScrolledRef.current = true;
        setShouldScroll(true);
    }, [isDisabled]);

    useEffect(() => {
        if (!shouldScroll) return;

        const node = ref.current;
        if (!node) return;

        const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        node.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
        setShouldScroll(false);
    }, [shouldScroll]);

    return [ref, request];
};

export default useScrollIntoViewOnce;
