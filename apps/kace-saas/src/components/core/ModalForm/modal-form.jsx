import PropTypes from "prop-types";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Button,
    GeneralLoader,
    cn,
} from "@kace/ui-shared";
import { Form } from "formik";
import { INITIAL_VALUES_STATES } from "../../../pages/States/data/constants";
import { useTranslation } from "react-i18next";
import { PlusIcon } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { setIdSelectedAndEnableEdit, setOpenModal } from "../../../redux/state/modalBehavior";
import { DialogClose } from "@radix-ui/react-dialog";
import { formatTestId } from "@/utils/src/helpers";

const ModalForm = ({
    children,
    open,
    isLoading,
    title,
    subtitle,
    setFormValues,
    pending = false,
    resetForm,
    isIcon = true,
    sizeBig = false,
    setOpen,
    setIdSelected,
    canBeEdit = true,
    hasEntity = false,
}) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const canBeEditState = useSelector((state) => state.modalBehavior.canBeEdit);
    const isReadOnly = !canBeEditState || !canBeEdit;
    return (
        <Dialog
            open={open}
            onOpenChange={() => {
                if (!open) {
                    setIdSelected && setIdSelected(null);
                    dispatch(setIdSelectedAndEnableEdit(null));
                }
                setOpen && setOpen(!open);
                dispatch(setOpenModal(!open));
            }}
        >
            <DialogTrigger asChild>
                {isIcon && (
                    <Button
                        size="icon"
                        id={formatTestId("btn_open_modal_form", `${title}`)}
                        data-testid={formatTestId("btn_open_modal_form", `${title}`)}
                        onClick={() => {
                            setFormValues != null && setFormValues(INITIAL_VALUES_STATES);
                            resetForm != null && resetForm();
                        }}
                    >
                        <PlusIcon />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent
                className={cn("sm:max-w-xl max-h-[calc(100vh-5rem)] overflow-auto", sizeBig && "sm:max-w-2xl")}
            >
                <DialogHeader>
                    <DialogClose type="button" />
                    <div className="flex flex-row justify-between items-center pr-10">
                        <div>
                            <DialogTitle>
                                {hasEntity
                                    ? canBeEditState
                                        ? `${t("app.forms.titles.edit", { entity: title })}`
                                        : `${t("app.forms.titles.see", { entity: title })}`
                                    : `${t("app.forms.titles.create", { entity: title })}`}
                            </DialogTitle>
                            <DialogDescription>{t(subtitle)}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                <Form autoComplete="off">
                    <fieldset disabled={isReadOnly} className="contents">
                        <div className="grid gap-4 py-4">
                            {isReadOnly && <div className="bg-transparent absolute h-full w-full z-50"></div>}
                            {isLoading ? <GeneralLoader /> : children}
                        </div>
                        <DialogFooter>
                            <Button
                                type="reset"
                                variant="outline"
                                onClick={resetForm}
                                id="btn_clear_modal_form"
                                data-testid="btn_clear_modal_form"
                            >
                                {t("button.clear")}
                            </Button>
                            <Button
                                type="submit"
                                id="btn_save_modal_form"
                                data-testid="btn_save_modal_form"
                                disabled={pending}
                            >
                                {pending ? "Enviando..." : t("button.save")}
                            </Button>
                        </DialogFooter>
                    </fieldset>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

ModalForm.propTypes = {
    children: PropTypes.node,
    open: PropTypes.bool,
    setIdSelected: PropTypes.func,
    isLoading: PropTypes.bool,
    title: PropTypes.string,
    subtitle: PropTypes.string,
    setFormValues: PropTypes.func,
    pending: PropTypes.bool,
    resetForm: PropTypes.func,
    isIcon: PropTypes.bool,
    canBeEdit: PropTypes.bool,
    sizeBig: PropTypes.bool,
    setOpen: PropTypes.func,
    hasEntity: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
};

export default ModalForm;
