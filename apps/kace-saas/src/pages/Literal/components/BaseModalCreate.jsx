import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    InputForm as Input,
    KField
} from "@kace/ui-shared"
import { useTranslation } from "react-i18next"
import { Form, Formik } from "formik"
import { joiFormikAdapter } from "@kace/utils"
import { literalSchemaForm } from "../../../schemas/LiteralSchema"
import InputCard from "../../../components/core/Cards/InputCard"
import { INITIAL_VALUES_LITERAL } from "../data/constants"
import PropTypes from "prop-types"
import { cn } from "../../../components/ui-shared/src/lib/utils"
import useLiteralHook from "../hooks/useLiteralHook"
import useFieldModalLiteral from "../hooks/useFieldModalLiteral"
import { useEffect, useState } from "react"

export const BaseModalCreate = ({
    iconAction = <></>,
    titleButton = "",
    data = null,
    className = "",
    isIcon = false,
    variantProp = "default",
    type,
    selected,
    labelTest = "base_modal_create",
}) => {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const { handleLiteral, isLoadingNewField } =
        useLiteralHook({ setOpen })
    const {
        handleSendFieldInformation,
        loadingData
    } = useFieldModalLiteral({ setOpenModal: setOpen })
    const loading = loadingData || isLoadingNewField
    const [tittle, setTittle] = useState(t("app.text.model"))
    const [subTittle, setSubTittle] = useState(t("app.text.nameNewModel"))
    useEffect(() => {
        if (type === "literal") {
            setTittle(`${data?.id ? t("app.forms.update") : t("app.forms.create")} ${t("app.text.model")}`)
            setSubTittle(t("app.text.nameNewModel"))
        }
        if (type === "field") {
            setTittle(`${data?.id ? t("app.forms.update") : t("app.forms.create")} ${t("app.text.field")}`)
            setSubTittle(t("app.text.nameNewField"))
        }
        if (type === "option") {
            setTittle(`${data?.id ? t("app.forms.update") : t("app.forms.create")} ${t("app.text.option")}`)
            setSubTittle(t("app.text.nameNewOption"))
        }
    }, [])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    disabled={loading}
                    className={cn(className, `${loading && "cursor-not-allowed opacity-40"}`)}
                    size={isIcon ? "icon" : "default"}
                    variant={variantProp}
                    id={labelTest}
                    data-testid={labelTest}
                >
                    {iconAction} {t(titleButton)}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <Formik
                    enableReinitialize={true}
                    validationSchema={joiFormikAdapter(literalSchemaForm)}
                    initialValues={data || INITIAL_VALUES_LITERAL}
                    onSubmit={(values) => {
                        if (type === "literal") {
                            handleLiteral(values, false);
                        }
                        if (type === "field") {
                            handleSendFieldInformation(values, selected.literal?.id);
                        }
                        if (type === "option") {
                            handleSendFieldInformation(values, selected.field?.id);
                        }
                    }}
                >
                    <Form className="flex flex-col gap-6" autoComplete="off">
                        <DialogHeader>
                            <DialogTitle>{tittle}</DialogTitle>
                            <DialogDescription>{subTittle}</DialogDescription>
                        </DialogHeader>
                        <div className="flex items-center space-x-2">
                            <div className="grid flex-1 gap-2">
                                <InputCard>
                                    <KField>
                                        <Input
                                            id="nombre"
                                            name="nombre"
                                            type="text"
                                            label={t("app.forms.name")}
                                            placeholder={t("app.forms.name")}
                                            className="flex flex-col items-start justify-start text-start"
                                            data-testid="base_modal_input_nombre"
                                        />
                                    </KField>
                                </InputCard>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="submit"
                                disabled={loading}
                                className={cn(className, `${loading && "cursor-not-allowed opacity-40"}`)}
                                id="btn_base_modal_submit"
                                data-testid="btn_base_modal_submit"
                            >
                                {t(`button.${loading ? "sending" : "save"}`)}
                            </Button>
                        </DialogFooter>
                    </Form>
                </Formik>
            </DialogContent>
        </Dialog>
    );
}

BaseModalCreate.propTypes = {
    iconAction: PropTypes.node.isRequired,
    titleButton: PropTypes.string,
    data: PropTypes.object,
    className: PropTypes.string,
    isIcon: PropTypes.bool,
    variantProp: PropTypes.string,
    handleAction: PropTypes.func,
    isLoadingNewField: PropTypes.bool,
    type: PropTypes.string,
    selected: PropTypes.object
}
