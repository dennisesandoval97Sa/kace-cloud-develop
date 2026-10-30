import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Formik, Form } from "formik";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { joiFormikAdapter } from "@kace/utils";
import {
    casoReassignSchemaForm,
    changeStateCaseSchema,
    closeReasonFormikJoiOptions,
    createBoardCasesBulkCloseSchema,
} from "@/schemas/CasoSchema";
import { initialValuesReassing, initialValuesChangeStateCase } from "@/pages/Cases/data/Constants";
import CombinedBulkActionsModal from "@kace_v2/shared/ui/organisms/CombinedBulkActionsModal/CombinedBulkActionsModal";
import { useBulkSectionInvalidState } from "@kace_v2/shared/ui/organisms/CombinedBulkActionsModal/FormikSectionValidityReporter";
import BulkSection from "@kace_v2/shared/ui/organisms/CombinedBulkActionsModal/BulkSection";
import useCombinedBulkActionsOrchestrator, {
    submitFormikSection,
    submitOptionalFormikSection,
} from "@kace_v2/shared/hooks/useCombinedBulkActionsOrchestrator.hook";
import { BoardCasesBulkAssignFields } from "./BoardCasesBulkAssignFields";
import { BoardCasesBulkTransitionFields } from "./BoardCasesBulkTransitionFields";
import { BoardCasesBulkCloseFields } from "./BoardCasesBulkCloseFields";

const BoardCasesBulkCombinedModal = ({
    open,
    onOpenChange,
    referenceCaseId,
    selectedCount,
    canReassign,
    canChangeState,
    changeStateDisabled,
    canClose,
    handleAssignSubmit,
    handleTransitionSubmit,
    handleCloseSubmit,
    invalidateBoardResources,
    clearSelection,
}) => {
    const { t } = useTranslation();
    const [closeEnabled, setCloseEnabled] = useState(false);
    const { onInvalidChange, mergeInvalid } = useBulkSectionInvalidState();
    const changeStateRef = useRef(null);
    const reassignRef = useRef(null);
    const closeRef = useRef(null);

    const closeSchema = useMemo(() => createBoardCasesBulkCloseSchema(), []);

    const { runAll, isRunning, results, hasAnyFailure, hasRunAny, reset } = useCombinedBulkActionsOrchestrator({
        steps: {
            change_state: {
                enabled: canChangeState && !changeStateDisabled,
                submit: () => submitOptionalFormikSection(changeStateRef, (values) => !values.transicion_id),
            },
            reassign: {
                enabled: canReassign,
                submit: () => submitOptionalFormikSection(reassignRef, (values) => !values.tipo),
            },
            close: {
                enabled: canClose && closeEnabled,
                submit: () => submitFormikSection(closeRef),
            },
        },
        onAllSettled: (acc, { allSkipped }) => {
            if (allSkipped) {
                toast.info(t("combinedBulkActions.noActionsRun"));
                reset();
                return;
            }
            const anyFailure = Object.values(acc).some((r) => r.status === "error" || r.status === "partial");
            invalidateBoardResources();
            if (!anyFailure) {
                clearSelection();
                onOpenChange(false);
            }
        },
    });

    useEffect(() => {
        if (!open) return;
        setCloseEnabled(false);
        reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const sectionTemplates = useMemo(() => {
        const list = [];
        if (canChangeState) {
            list.push({
                key: "change_state",
                label: t("combinedBulkActions.sections.changeState"),
                enabled: true,
                disabledReason: changeStateDisabled
                    ? t("combinedBulkActions.sections.changeStateDisabledReason")
                    : null,
                result: results.change_state,
                content: (
                    <Formik
                        innerRef={changeStateRef}
                        enableReinitialize
                        initialValues={initialValuesChangeStateCase}
                        validationSchema={joiFormikAdapter(changeStateCaseSchema)}
                        onSubmit={(values) => handleTransitionSubmit(values.transicion_id)}
                    >
                        {({ errors, values, setFieldValue }) => (
                            <Form className="grid gap-4">
                                <BulkSection
                                    sectionKey="change_state"
                                    schema={changeStateCaseSchema}
                                    isIntended={(current) => Boolean(current.transicion_id)}
                                    onInvalidChange={onInvalidChange}
                                >
                                    <BoardCasesBulkTransitionFields
                                        referenceCaseId={referenceCaseId}
                                        errors={errors}
                                        values={values}
                                        setFieldValue={setFieldValue}
                                    />
                                </BulkSection>
                            </Form>
                        )}
                    </Formik>
                ),
            });
        }
        if (canReassign) {
            list.push({
                key: "reassign",
                label: t("combinedBulkActions.sections.reassign"),
                enabled: true,
                result: results.reassign,
                content: (
                    <Formik
                        innerRef={reassignRef}
                        enableReinitialize
                        initialValues={initialValuesReassing}
                        validationSchema={joiFormikAdapter(casoReassignSchemaForm)}
                        onSubmit={(values) =>
                            handleAssignSubmit({
                                group_id: values.grupo_id,
                                responsible_id: values.tipo === "2" ? values.usuario_id : null,
                            })
                        }
                    >
                        {({ errors, values, setFieldValue }) => (
                            <Form className="grid gap-4">
                                <BulkSection
                                    sectionKey="reassign"
                                    schema={casoReassignSchemaForm}
                                    isIntended={(current) => Boolean(current.tipo)}
                                    onInvalidChange={onInvalidChange}
                                >
                                    <BoardCasesBulkAssignFields
                                        errors={errors}
                                        values={values}
                                        setFieldValue={setFieldValue}
                                    />
                                </BulkSection>
                            </Form>
                        )}
                    </Formik>
                ),
            });
        }
        if (canClose) {
            list.push({
                key: "close",
                label: t("combinedBulkActions.closeCheckboxLabel"),
                enabled: closeEnabled,
                onToggleEnabled: setCloseEnabled,
                result: results.close,
                content: (
                    <Formik
                        innerRef={closeRef}
                        enableReinitialize
                        validateOnMount
                        initialValues={{ close_reason: "" }}
                        validationSchema={joiFormikAdapter(closeSchema, closeReasonFormikJoiOptions)}
                        onSubmit={(values) => handleCloseSubmit(values.close_reason)}
                    >
                        {({ errors, values, setFieldValue }) => (
                            <Form className="grid gap-4">
                                <BulkSection
                                    sectionKey="close"
                                    schema={closeSchema}
                                    isIntended={() => true}
                                    onInvalidChange={onInvalidChange}
                                >
                                    <BoardCasesBulkCloseFields
                                        errors={errors}
                                        values={values}
                                        setFieldValue={setFieldValue}
                                    />
                                </BulkSection>
                            </Form>
                        )}
                    </Formik>
                ),
            });
        }
        return list;
    }, [
        canChangeState,
        changeStateDisabled,
        canReassign,
        canClose,
        closeEnabled,
        results,
        referenceCaseId,
        closeSchema,
        t,
        handleTransitionSubmit,
        handleAssignSubmit,
        handleCloseSubmit,
        onInvalidChange,
    ]);

    const sections = useMemo(() => mergeInvalid(sectionTemplates), [mergeInvalid, sectionTemplates]);

    return (
        <CombinedBulkActionsModal
            open={open}
            onOpenChange={onOpenChange}
            sections={sections}
            selectedCount={selectedCount}
            isRunning={isRunning}
            hasAnyFailure={hasAnyFailure}
            hasRunAny={hasRunAny}
            onConfirm={runAll}
            onRequestClose={() => onOpenChange(false)}
        />
    );
};

BoardCasesBulkCombinedModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    referenceCaseId: PropTypes.string,
    selectedCount: PropTypes.number,
    canReassign: PropTypes.bool,
    canChangeState: PropTypes.bool,
    changeStateDisabled: PropTypes.bool,
    canClose: PropTypes.bool,
    handleAssignSubmit: PropTypes.func.isRequired,
    handleTransitionSubmit: PropTypes.func.isRequired,
    handleCloseSubmit: PropTypes.func.isRequired,
    invalidateBoardResources: PropTypes.func.isRequired,
    clearSelection: PropTypes.func.isRequired,
};

export default BoardCasesBulkCombinedModal;
