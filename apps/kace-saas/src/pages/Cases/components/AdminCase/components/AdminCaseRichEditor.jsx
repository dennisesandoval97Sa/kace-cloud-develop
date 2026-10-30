import { useEffect, useRef, useCallback } from "react";
import { RichEditor } from "../../../../../components/core/Editor/Editor";
import useDebounced from "@kace/hooks/useDebounced";
import { AdminCaseCardModules } from "./AdminCaseCardModules";
import useAdminCaseUserInfo from "../hooks/useAdminCaseUserInfo";
import { useFormikContext } from "formik";
import useAdminCaseDescription from "../hooks/useAdminCaseDescription";
import PropTypes from "prop-types";

const AdminCaseRichEditor = ({ initialValue = "", isOSURL = null, componentsStates = false }) => {
    const { userCanEditCase } = useAdminCaseUserInfo();
    const { values, setFieldValue, submitForm } = useFormikContext();
    const { handleCreateDescription } = useAdminCaseDescription();
    const isTempCase = useRef(false);
    const isFirstRender = useRef(true);
    const isPasteAction = useRef(false);

    const immediateSetValue = useCallback(
        (key, value) => {
            if (!isFirstRender.current) {
                isPasteAction.current = true;
                setFieldValue(key, value);
            }
        },
        [setFieldValue],
    );

    const debouncedOnChange = useDebounced(
        (key, value) => {
            if (!isFirstRender.current) {
                setFieldValue(key, value);
            }
        },
        800,
        { flushOnUnmount: true },
    );

    // A reinitialize remounts the editor with the new description; an edit typed into the old one no longer applies.
    useEffect(() => {
        debouncedOnChange.cancel();
    }, [values.descripcion_caso_id, debouncedOnChange]);

    useEffect(() => {
        isTempCase.current = isOSURL && userCanEditCase;
    }, [isOSURL, userCanEditCase]);

    useEffect(() => {
        if (!isTempCase.current) return;

        if (isPasteAction.current) {
            handleCreateDescription(values.descripcion_caso_id, values.descripcion_caso, false);
            isPasteAction.current = false;
            return;
        }

        if (componentsStates) {
            submitForm();
        }
    }, [values.descripcion_caso]);

    useEffect(() => {
        isFirstRender.current = false;
    }, []);

    return (
        <div className="relative h-96 w-full">
            <AdminCaseCardModules title="globalConfigLabels.descripcion.titulo_descripcion" className="h-full">
                <RichEditor
                    key={values.descripcion_caso_id}
                    value={initialValue}
                    setValue={debouncedOnChange}
                    onPaste={immediateSetValue}
                    onBlur={debouncedOnChange.flush}
                    name="descripcion_caso"
                    readOnly={!userCanEditCase}
                />
            </AdminCaseCardModules>
        </div>
    );
};

AdminCaseRichEditor.propTypes = {
    initialValue: PropTypes.string,
    isOSURL: PropTypes.bool,
    componentsStates: PropTypes.bool,
};

export default AdminCaseRichEditor;
