const { default: JSONEditor } = require("@/componentsV2/lib/JSONEditor");
const { transformToJSON } = require("@/componentsV2/lib/JSONEditor/helpers");
const { useFormikContext } = require("formik");
const PropTypes = require("prop-types");

const JSONEditorWrapper = ({ onContextChange }) => {
    const { values } = useFormikContext();

    useEffect(() => {
        const jsonData = transformToJSON(values.properties);
        onContextChange(jsonData);
    }, [values.properties, onContextChange]);

    return <JSONEditor namePrefix="properties" allowObjects allowArrays />;
};

JSONEditorWrapper.propTypes = {
    onContextChange: PropTypes.func.isRequired,
};
