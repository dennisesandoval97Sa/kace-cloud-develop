import PropTypes from "prop-types";
import FormikSectionValidityReporter from "./FormikSectionValidityReporter";

export const BulkSection = ({ sectionKey, schema, isIntended, onInvalidChange, children }) => (
    <>
        <FormikSectionValidityReporter
            sectionKey={sectionKey}
            schema={schema}
            isIntended={isIntended}
            onInvalidChange={onInvalidChange}
        />
        {children}
    </>
);

BulkSection.propTypes = {
    sectionKey: PropTypes.string.isRequired,
    schema: PropTypes.object.isRequired,
    isIntended: PropTypes.func.isRequired,
    onInvalidChange: PropTypes.func.isRequired,
    children: PropTypes.node,
};

export default BulkSection;
