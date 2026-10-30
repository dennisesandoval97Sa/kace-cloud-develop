import { useEffect } from "react";
import { useSelector } from "react-redux";
import { Formik, Form } from "formik";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
import { Search } from "lucide-react";

import { Button, KField } from "@kace/ui-shared";
import { SelectField } from "./SelectField";
import { InputSearch } from "./InputSearch";

const SearchClientForm = ({ dataHandler, options = [] }) => {
    const { t } = useTranslation();
    const inputSearchFilter = useSelector((state) => state.states.inputSearchFilter);

    const initialValues = {
        type: "",
        payload: "",
    };

    const handleSubmit = (values, { resetForm }) => {
        if (!values.payload) {
            toast.warning("Debes agregar información a buscar");
        } else if (!values.type) {
            toast.warning("Debes seleccionar un tipo de búsqueda");
        } else {
            dataHandler(values);
            resetForm();
        }
    };

    return (
        <Formik enableReinitialize initialValues={initialValues} onSubmit={handleSubmit}>
            {(formikProps) => (
                <InnerForm {...formikProps} t={t} options={options} inputSearchFilter={inputSearchFilter} />
            )}
        </Formik>
    );
};

const InnerForm = ({ resetForm, t, options, inputSearchFilter }) => {
    useEffect(() => {
        resetForm();
    }, [inputSearchFilter, resetForm]);

    return (
        <Form autoComplete="off">
            <div className="flex max-sm:w-full items-center justify-center md:w-80 lg:96">
                <KField>
                    <InputSearch
                        name="payload"
                        type="text"
                        placeholder={t("app.forms.search")}
                        className="rounded-none rounded-l-lg focus-visible:ring-0 focus-visible:ring-offset-0 w-3/6"
                        classNameInput="rounded-none rounded-l-lg focus-visible:ring-0 focus-visible:ring-offset-0 w-3/6"
                    />
                </KField>
                <KField>
                    <SelectField options={options} name="type" className="rounded-none rounded-r-lg w-2/6" />
                </KField>
                <Button
                    type="submit"
                    className="rounded-none rounded-r-lg w-1/6"
                    size="icon"
                    id="btn_search_client"
                    data-testid="btn_search_client"
                >
                    <Search />
                </Button>
            </div>
        </Form>
    );
};

SearchClientForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    options: PropTypes.arrayOf(
        PropTypes.shape({
            value: PropTypes.string.isRequired,
            label: PropTypes.string.isRequired,
        }),
    ).isRequired,
};

export default SearchClientForm;
