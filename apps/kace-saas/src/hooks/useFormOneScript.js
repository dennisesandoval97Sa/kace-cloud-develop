import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { getDataByProvider } from "@kace/utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const useFormOneScript = (url) => {
    const { t } = useTranslation();
    const [form, setForm] = useState({});
    const [dataForm, setDataForm] = useState({});
    const formRef = useRef(null);

    const { data } = useQuery({
        queryKey: [url],
        queryFn: () => getDataByProvider(url),
        enabled: !!url,
    });
    useEffect(() => {
        if (data) {
            setForm(data.schemaData);
        }
    }, [data]);

    const handleCustomEvent = () => {
        const isValid = formRef.current.checkValidity();
        const formData = formRef.current.getValue();

        if (!isValid && formRef.current.errors.length > 0) {
            const invalidFields = formRef.current.errors.map((error) => ({
                fieldName: error.path,
                errorMessage: error.message,
            }));
            if (invalidFields.length > 0) {
                const errorMessages = invalidFields.map(f => f.errorMessage).join(", ");
                toast.warning("Verifique los campos del formulario: " + errorMessages);
            }

            const errorMessages = invalidFields.map(f => f.errorMessage).join(", ");
            toast.warning(`${t("app.alerts.formValidationError")}: ${errorMessages}`);

            setDataForm({});
            return {};
        }

        formData.data = Object.entries(formData.data)
            .filter(([key]) => key !== "dataKace")
            .reduce((acc, [key, value]) => {
                acc[key] = value;
                return acc;
            }, {});

        setDataForm(formData);
        return formData;
    };

    return {
        formRef,
        form,
        handleCustomEvent,
        dataForm,
    };
};

export default useFormOneScript;
