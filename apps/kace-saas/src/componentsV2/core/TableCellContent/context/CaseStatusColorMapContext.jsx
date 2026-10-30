import { createContext, useContext } from "react";
import PropTypes from "prop-types";

const CaseStatusColorMapContext = createContext({});

export const CaseStatusColorMapProvider = ({ value = {}, children }) => (
    <CaseStatusColorMapContext.Provider value={value}>{children}</CaseStatusColorMapContext.Provider>
);

CaseStatusColorMapProvider.propTypes = {
    value: PropTypes.object,
    children: PropTypes.node.isRequired,
};

export const useCaseStatusColorMap = () => useContext(CaseStatusColorMapContext);
