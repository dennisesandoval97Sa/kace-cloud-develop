import { useEffect, useRef, useState } from "react";

const useBoardVisibility = (isExpanded) => {
    const contentRef = useRef(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!isExpanded || !contentRef.current) {
            setIsVisible(false);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            {
                threshold: 0,
                rootMargin: "0px",
            },
        );

        observer.observe(contentRef.current);

        return () => {
            observer.disconnect();
        };
    }, [isExpanded]);

    return { isVisible, contentRef };
};

export default useBoardVisibility;
