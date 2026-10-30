import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import PropTypes from "prop-types";

const NavigationBlockerContext = createContext(null);

export const NavigationBlockerProvider = ({ children }) => {
    const shouldBlockRef = useRef(true);

    const disableBlocker = useCallback(() => {
        shouldBlockRef.current = false;
    }, [shouldBlockRef]);

    const value = useMemo(() => ({ shouldBlockRef, disableBlocker }), [shouldBlockRef, disableBlocker]);

    return <NavigationBlockerContext.Provider value={value}>{children}</NavigationBlockerContext.Provider>;
};

NavigationBlockerProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export const useNavigationBlocker = () => {
    const context = useContext(NavigationBlockerContext);
    if (!context) {
        return { shouldBlockRef: { current: false }, disableBlocker: () => {} };
    }
    return context;
};
