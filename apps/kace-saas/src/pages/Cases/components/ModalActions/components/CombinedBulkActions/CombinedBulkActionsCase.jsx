import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Formik, Form } from "formik";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { joiFormikAdapter } from "@kace/utils";
import {
    changeStateCaseSchema,
    caseCloseSchema,
    casoReassignSchemaForm,
    closeReasonFormikJoiOptions,
} from "@/schemas/CasoSchema";
import { initialValuesReassing, initialValuesChangeStateCase } from "@/pages/Cases/data/Constants";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import CombinedBulkActionsModal from "@kace_v2/shared/ui/organisms/CombinedBulkActionsModal/CombinedBulkActionsModal";
import { useBulkSectionInvalidState } from "@kace_v2/shared/ui/organisms/CombinedBulkActionsModal/FormikSectionValidityReporter";
import BulkSection from "@kace_v2/shared/ui/organisms/CombinedBulkActionsModal/BulkSection";
import useCombinedBulkActionsOrchestrator, {
    submitFormikSection,
    submitOptionalFormikSection,
} from "@kace_v2/shared/hooks/useCombinedBulkActionsOrchestrator.hook";
import { hasSameTransicion } from "@kace_v2/features/boards/utils/boardCasesBulk.utils";
import useSelectedCases from "@/pages/Cases/hooks/useSelectedCases";
import { useReassignCase } from "../ReAssignCase/hooks/useReassignCase";
import useCaseClose from "../CloseCase/hooks/useCaseClose";
import { useChangeStateCase } from "../ChangeStateCase/hooks/useChangeStateCase";
import { ReassignCaseFields } from "../ReAssignCase/ReassignCaseFields";
import { ChangeStateCaseFields } from "../ChangeStateCase/ChangeStateCaseFields";
import { CloseCaseFields } from "../CloseCase/CloseCaseFields";

const CombinedBulkActionsCase = ({ open, onOpenChange, canReassign, canClose, canChangeState }) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { selectedCases, setSelectedCases, clearSelectedCases } = useSelectedCases();

    const [closeEnabled, setCloseEnabled] = useState(false);
    const { onInvalidChange, mergeInvalid } = useBulkSectionInvalidState();

    const changeStateRef = useRef(null);
    const reassignRef = useRef(null);
    const closeRef = useRef(null);

    const { handleReassignUser, handleReassignGroup } = useReassignCase();
    const { handleCaseClose } = useCaseClose();
    const { handleChangeState } = useChangeStateCase();

    const caseId = selectedCases?.[0]?.id;

    const changeStateDisabledReason = useMemo(() => {
        if (hasSameTransicion(selectedCases)) return null;
        return t("combinedBulkActions.sections.changeStateDisabledReason");
    }, [selectedCases, t]);

    const finalizeSelection = (acc) => {
        const failedIds = new Set();
        Object.values(acc).forEach((result) => {
            if (result.status === "error" || result.status === "partial") {
                (result.failedIds ?? []).forEach((id) => failedIds.add(id));
            }
        });
        queryClient.invalidateQueries({ queryKey: [URL_AND_KEYS.cases.key], exact: false });
        if (failedIds.size) {
            setSelectedCases((prev) => prev.filter((c) => failedIds.has(c.id)));
        } else {
            clearSelectedCases();
            onOpenChange(false);
        }
    };

    const { runAll, isRunning, results, hasAnyFailure, hasRunAny, reset } = useCombinedBulkActionsOrchestrator({
        steps: {
            change_state: {
                enabled: canChangeState && !changeStateDisabledReason,
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
            finalizeSelection(acc);
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
                disabledReason: changeStateDisabledReason,
                result: results.change_state,
                content: (
                    <Formik
                        innerRef={changeStateRef}
                        enableReinitialize
                        initialValues={initialValuesChangeStateCase}
                        validationSchema={joiFormikAdapter(changeStateCaseSchema)}
                        onSubmit={(values) => handleChangeState(values, { combined: true })}
                    >
                        {({ errors, touched, values, setFieldValue }) => (
                            <Form autoComplete="off">
                                <BulkSection
                                    sectionKey="change_state"
                                    schema={changeStateCaseSchema}
                                    isIntended={(current) => Boolean(current.transicion_id)}
                                    onInvalidChange={onInvalidChange}
                                >
                                    <ChangeStateCaseFields
                                        caseId={caseId}
                                        errors={errors}
                                        touched={touched}
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
                            values.tipo === "1"
                                ? handleReassignGroup(values, { combined: true })
                                : handleReassignUser(values, { combined: true })
                        }
                    >
                        {({ errors, touched, values, setFieldValue }) => (
                            <Form autoComplete="off">
                                <BulkSection
                                    sectionKey="reassign"
                                    schema={casoReassignSchemaForm}
                                    isIntended={(current) => Boolean(current.tipo)}
                                    onInvalidChange={onInvalidChange}
                                >
                                    <ReassignCaseFields
                                        errors={errors}
                                        touched={touched}
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
                        initialValues={{ motivo_baja: "" }}
                        validationSchema={joiFormikAdapter(caseCloseSchema, closeReasonFormikJoiOptions)}
                        onSubmit={(values) => handleCaseClose(values, { combined: true })}
                    >
                        <Form autoComplete="off">
                            <BulkSection
                                sectionKey="close"
                                schema={caseCloseSchema}
                                isIntended={() => true}
                                onInvalidChange={onInvalidChange}
                            >
                                <CloseCaseFields forceShowError />
                            </BulkSection>
                        </Form>
                    </Formik>
                ),
            });
        }
        return list;
    }, [
        canChangeState,
        canReassign,
        canClose,
        closeEnabled,
        changeStateDisabledReason,
        results,
        caseId,
        t,
        handleChangeState,
        handleReassignGroup,
        handleReassignUser,
        handleCaseClose,
        onInvalidChange,
    ]);

    const sections = useMemo(() => mergeInvalid(sectionTemplates), [mergeInvalid, sectionTemplates]);

    return (
        <CombinedBulkActionsModal
            open={open}
            onOpenChange={onOpenChange}
            sections={sections}
            selectedCount={selectedCases.length}
            isRunning={isRunning}
            hasAnyFailure={hasAnyFailure}
            hasRunAny={hasRunAny}
            onConfirm={runAll}
            onRequestClose={() => onOpenChange(false)}
        />
    );
};

CombinedBulkActionsCase.propTypes = {
    open: PropTypes.bool.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    canReassign: PropTypes.bool,
    canClose: PropTypes.bool,
    canChangeState: PropTypes.bool,
};

export default CombinedBulkActionsCase;
