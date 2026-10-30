import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useFormikContext } from "formik";

/**
 * Reporta al modal combinado si la sección Formik actual está inválida
 * *y* el usuario pretende ejecutarla. Las secciones opcionales vacías no
 * bloquean Confirmar.
 */
const FormikSectionValidityReporter = ({ sectionKey, isIntended, onInvalidChange, schema }) => {
    const { errors, values } = useFormikContext();
    const hasErrors = schema
        ? Boolean(schema.validate(values, { abortEarly: true, allowUnknown: true, convert: false }).error)
        : Object.keys(errors).length > 0;
    const invalid = Boolean(isIntended(values) && hasErrors);

    useEffect(() => {
        onInvalidChange(sectionKey, invalid);
        return () => onInvalidChange(sectionKey, false);
    }, [sectionKey, invalid, onInvalidChange]);

    return null;
};

FormikSectionValidityReporter.propTypes = {
    sectionKey: PropTypes.string.isRequired,
    isIntended: PropTypes.func.isRequired,
    onInvalidChange: PropTypes.func.isRequired,
    schema: PropTypes.object,
};

export const useBulkSectionInvalidState = () => {
    const [invalidByKey, setInvalidByKey] = useState({});

    const onInvalidChange = useCallback((key, invalid) => {
        setInvalidByKey((prev) => (prev[key] === invalid ? prev : { ...prev, [key]: invalid }));
    }, []);

    const mergeInvalid = useCallback(
        (sections) => sections.map((section) => ({ ...section, isInvalid: Boolean(invalidByKey[section.key]) })),
        [invalidByKey],
    );

    return { onInvalidChange, mergeInvalid };
};

export default FormikSectionValidityReporter;
