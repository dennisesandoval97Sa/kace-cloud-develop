import { InputForm as Input, KField } from "@kace/ui-shared";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";

export const InputsClassificationContainer = () => {
    const { t } = useTranslation();

    return (
        <div className="px-2 grid md:grid-cols-2 grid-cols-1 gap-2">
            <div className="flex flex-col gap-2">
                <KField>
                    <Input
                        id="label_1"
                        name="label_1"
                        label={t("generalSetup.form.labels.label_1")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="label_2"
                        name="label_2"
                        label={t("generalSetup.form.labels.label_2")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="label_3"
                        name="label_3"
                        label={t("generalSetup.form.labels.label_3")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="label_4"
                        name="label_4"
                        label={t("generalSetup.form.labels.label_4")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="label_5"
                        name="label_5"
                        label={t("generalSetup.form.labels.label_5")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
            </div>
            <div className="flex flex-col gap-2">
                <KField>
                    <Input
                        id="label_6"
                        name="label_6"
                        label={t("generalSetup.form.labels.label_6")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="label_7"
                        name="label_7"
                        label={t("generalSetup.form.labels.label_7")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="label_8"
                        name="label_8"
                        label={t("generalSetup.form.labels.label_8")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="label_9"
                        name="label_9"
                        label={t("generalSetup.form.labels.label_9")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="label_10"
                        name="label_10"
                        label={t("generalSetup.form.labels.label_10")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
            </div>
        </div>
    )
}

InputsClassificationContainer.propTypes = {
    values: PropTypes.object,
};
