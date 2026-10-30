import { Form, Formik } from "formik";
import FormCard from "../../../components/core/Cards/FormCard";
import SectionForm from "../../../components/core/Cards/section-form";
import InputCard from "../../../components/core/Cards/InputCard";
import { InputForm as Input, KField } from "@kace/ui-shared";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import { PropTypes } from "prop-types";
import { INITIAL_VALUES_TRANSITION_RULE } from "../data/constants";
import { BuilderContainer } from "../../Actions/components/builderComponents/BuilderContainer";
import { VALUELESS_OPERATORS } from "../../Actions/data/constants";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { joiFormikAdapter } from "@kace/utils";
import { TransitionRuleSchemaForm } from "../../../schemas/TransitionRuleSchema";

const isRuleIncomplete = (rule) => {
    if (rule.field === "") return true;
    if (VALUELESS_OPERATORS.includes(rule.operator)) return false;
    return rule.value === "" || rule.value_type === "" || rule.type === "";
};

const validateThereAreRules = (conditions, t) => {
    if (!conditions || !Array.isArray(conditions.rules)) return t("actions.messages.minRuleRequired");

    const flattenRules = (rules) =>
        rules.reduce((acc, rule) => {
            if (Array.isArray(rule.rules)) acc.push(...flattenRules(rule.rules));
            else acc.push(rule);
            return acc;
        }, []);

    const checkRules = (rules) => {
        for (const rule of rules) {
            if (Array.isArray(rule.rules)) {
                const result = checkRules(rule.rules);
                if (result) return result;
            } else {
                if (isRuleIncomplete(rule)) {
                    return t("actions.messages.incompleteRules");
                }
            }
        }
        return null;
    };

    const totalRules = flattenRules(conditions.rules);
    if (totalRules.length === 0) return t("actions.messages.minRuleRequired");
    if (totalRules.length === 1) {
        if (isRuleIncomplete(totalRules[0])) {
            return t("actions.messages.minRuleRequired");
        }
    }
    return checkRules(conditions.rules);
};

export const TransitionRuleForm = ({ dataHandler, data = {}, isSending = false }) => {
    const [formValues, setFormValues] = useState(INITIAL_VALUES_TRANSITION_RULE);
    const [rules, setRules] = useState(INITIAL_VALUES_TRANSITION_RULE.conditions);
    const { t } = useTranslation();

    useEffect(() => {
        if (data && data.nombre !== undefined) {
            setRules(data.conditions ?? INITIAL_VALUES_TRANSITION_RULE.conditions);
            setFormValues({ ...INITIAL_VALUES_TRANSITION_RULE, ...data });
        }
    }, [data]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formValues}
            validationSchema={joiFormikAdapter(TransitionRuleSchemaForm)}
            onSubmit={(values) => {
                values.conditions = rules;
                const message = validateThereAreRules(values.conditions, t);
                if (message) {
                    toast.warning(message);
                    return;
                }
                dataHandler(values);
            }}
        >
            {() => (
                <Form className="flex w-full justify-center h-full overflow-auto" autoComplete="off">
                    <FormCard isId={data?.id} isSending={isSending}>
                        <div className="flex flex-col col-span-3 gap-8 h-full">
                            <SectionForm tittle={t("channelHub.transitionRules.form.information")}>
                                <InputCard>
                                    <KField>
                                        <Input
                                            type="text"
                                            name="nombre"
                                            label={t("channelHub.transitionRules.form.nombre")}
                                            placeholder={t("channelHub.transitionRules.form.nombrePlaceholder")}
                                            className="flex flex-col items-start justify-start text-start mx-2 mb-2"
                                        />
                                    </KField>
                                </InputCard>
                            </SectionForm>
                        </div>
                        {data?.id && (
                            <div className="flex flex-col col-span-3 gap-8 h-full">
                                <SectionForm tittle={t("app.forms.status")}>
                                    <InputCard>
                                        <KField>
                                            <SwitchStateAdmin name="status" />
                                        </KField>
                                    </InputCard>
                                </SectionForm>
                            </div>
                        )}
                        <div className="flex flex-col col-span-5">
                            <SectionForm tittle={t("actions.title.conditionAction")}>
                                <BuilderContainer setFieldValue={setRules} value={rules} />
                            </SectionForm>
                        </div>
                    </FormCard>
                </Form>
            )}
        </Formik>
    );
};

TransitionRuleForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
};
