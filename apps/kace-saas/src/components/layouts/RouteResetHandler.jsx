import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useLocation } from "react-router-dom";
import { setCurrentColor } from "@/redux/state/filterCases";

const RouteResetHandler = () => {
    const dispatch = useDispatch();
    const { pathname } = useLocation();

    useEffect(() => {
        ["modalBehavior"].forEach((slice) => {
            dispatch({ type: `${slice}/reset` });
            dispatch(setCurrentColor(""));
        });
    }, [pathname, dispatch]);

    return null;
};

export default RouteResetHandler;
