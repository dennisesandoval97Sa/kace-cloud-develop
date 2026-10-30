import { Formik, Form } from "formik";
import { InputFormModal as Input, KField, Button } from "@kace/ui-shared";
import InputCard from "../../../components/core/Cards/InputCard";
import { useTranslation } from "react-i18next";
import { CONDITIONAL_OPERATORS } from "@/enums/ConditionalOperators";

const CONDITION_TYPES_WITHOUT_VALUE = ["null", "notNull", "jsonEmpty", "jsonNotEmpty", "stringEmpty", "stringNotEmpty"];

const CONDITION_TYPES_WITHOUT_SINGLE_VALUE = ["between", ...CONDITION_TYPES_WITHOUT_VALUE];

const ConditionalNodeModal = ({ onClose, onCreate, nextY }) => {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow-xl max-w-md w-full">
                <h2 className="text-xl font-bold mb-4">{t("restFlow.newConditional")}</h2>
                <Formik
                    initialValues={{
                        filter: "",
                        conditionType: "eq",
                        value: "",
                        valueFrom: "",
                        valueTo: "",
                    }}
                    onSubmit={(v) => {
                        const operator = CONDITIONAL_OPERATORS[v.conditionType];
                        const isBetween = v.conditionType === "between";
                        const isNoValue = CONDITION_TYPES_WITHOUT_VALUE.includes(v.conditionType);

                        let label = "";
                        if (isBetween) {
                            label = `${t("actions.querybuilder.operatorLabels.if")}  ${v.filter} ${t("actions.querybuilder.operatorLabels.between")} ${v.valueFrom} ${t("actions.querybuilder.operatorLabels.andConditional")} ${v.valueTo}`;
                        } else if (isNoValue) {
                            label = `${t("actions.querybuilder.operatorLabels.if")} ${v.filter} ${operator}`;
                        } else {
                            label = `${t("actions.querybuilder.operatorLabels.if")} ${v.filter} ${operator} ${v.value}`;
                        }

                        const node = {
                            id: crypto.randomUUID(),
                            type: "conditional",
                            position: { x: 200, y: nextY },
                            data: {
                                id: crypto.randomUUID(),
                                label,
                                filter: v.filter,
                                operator,
                                conditionType: v.conditionType,
                                value: isBetween ? [v.valueFrom, v.valueTo] : v.value,
                                type: "conditional",
                            },
                            style: {
                                wordBreak: "break-word",
                            },
                        };

                        onCreate(node);
                        onClose();
                    }}
                >
                    {({ handleChange, values }) => (
                        <Form className="flex flex-col gap-4">
                            {/* FILTER */}
                            <InputCard>
                                <KField>
                                    <Input
                                        className="flex flex-col items-start justify-start text-start w-full gap-1.5"
                                        type="text"
                                        name="filter"
                                        onChange={handleChange}
                                        value={values.filter}
                                        placeholder={t("restFlow.inputFilter")}
                                        label={t("restFlow.inputFilter")}
                                    />
                                </KField>
                            </InputCard>

                            {/* CONDITION TYPE */}
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="conditionType" className="text-sm font-medium">
                                    {t("restFlow.conditionType")}
                                </label>
                                <KField>
                                    <select
                                        id="conditionType"
                                        className="border px-2 py-1 rounded w-full uppercase"
                                        name="conditionType"
                                        onChange={handleChange}
                                        value={values.conditionType}
                                    >
                                        {Object.keys(CONDITIONAL_OPERATORS).map((key) => (
                                            <option key={key} value={key}>
                                                {t(`actions.querybuilder.operatorLabels.${key}`)}
                                            </option>
                                        ))}
                                    </select>
                                </KField>
                            </div>

                            {/* SINGLE VALUE */}
                            {!CONDITION_TYPES_WITHOUT_SINGLE_VALUE.includes(values.conditionType) && (
                                <InputCard>
                                    <KField>
                                        <Input
                                            className="flex flex-col items-start justify-start text-start w-full gap-1.5"
                                            type="text"
                                            name="value"
                                            onChange={handleChange}
                                            value={values.value}
                                            placeholder={t("restFlow.value")}
                                            label={t("restFlow.value")}
                                        />
                                    </KField>
                                </InputCard>
                            )}

                            {/* BETWEEN: TWO VALUES */}
                            {values.conditionType === "between" && (
                                <>
                                    <InputCard>
                                        <KField>
                                            <Input
                                                className="flex flex-col items-start justify-start text-start w-full gap-1.5"
                                                type="text"
                                                name="valueFrom"
                                                onChange={handleChange}
                                                value={values.valueFrom}
                                                placeholder={t("restFlow.startValue")}
                                                label={t("restFlow.startValue")}
                                            />
                                        </KField>
                                    </InputCard>

                                    <InputCard>
                                        <KField>
                                            <Input
                                                className="flex flex-col items-start justify-start text-start w-full gap-1.5"
                                                type="text"
                                                name="valueTo"
                                                onChange={handleChange}
                                                value={values.valueTo}
                                                placeholder={t("restFlow.endValue")}
                                                label={t("restFlow.endValue")}
                                            />
                                        </KField>
                                    </InputCard>
                                </>
                            )}

                            <div className="flex justify-between items-center mt-4">
                                <Button type="button" variant="outline" onClick={onClose}>
                                    {t("app.forms.cancel")}
                                </Button>

                                <Button type="submit">{t("app.title.create")}</Button>
                            </div>
                        </Form>
                    )}
                </Formik>
            </div>
        </div>
    );
};

export default ConditionalNodeModal;
