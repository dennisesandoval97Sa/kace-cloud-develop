import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dialog, Portal, Trigger } from "@radix-ui/react-dialog";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { Filter, X } from "lucide-react";
import DialogOverlay from "@kace_v2/shared/ui/atoms/DialogOverlay";
import DialogContent from "@kace_v2/shared/ui/atoms/DialogContent";
import DialogClose from "@kace_v2/shared/ui/atoms/DialogClose";
import DialogTitle from "@kace_v2/shared/ui/atoms/DialogTitle";
import DialogDescription from "@kace_v2/shared/ui/atoms/DialogDescription";
import { Form, Formik } from "formik";
import DynamicInput from "@kace_v2/shared/ui/molecules/DynamicInput";
import { filterBuilder } from "@kace_v2/shared/utils/filterBuilder.util";
import { cn } from "@kace_v2/shared/utils/cn.util";

const EMPTY_INITIAL_VALUES = {};

const DataTableFilterModal = ({
    className,
    title,
    description,
    submitLabel,
    disabled,
    fields,
    initialValues = EMPTY_INITIAL_VALUES,
    onSubmit = () => {},
    ...props
}) => {
    const { t } = useTranslation();
    return (
        <Dialog {...props}>
            <Trigger asChild>
                <Button size="icon" variant="outline" type="button" disabled={disabled}>
                    <Filter />
                </Button>
            </Trigger>
            <Portal>
                <DialogOverlay />
                <DialogContent className={cn(className)}>
                    <DialogClose>
                        <Button size="icon" variant="outline">
                            <X className="h-4 w-4" />
                        </Button>
                    </DialogClose>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                    <div className="overflow-y-auto max-h-[60vh] pr-1">
                        <Formik
                            initialValues={initialValues}
                            enableReinitialize
                            onSubmit={(values) => {
                                onSubmit(Object.values(values).filter(Boolean), values);
                            }}
                        >
                            {({ setFieldValue, values }) => (
                                <Form className={cn("gap-4", fields.length > 3 ? "grid grid-cols-2" : "flex flex-col")}>
                                    {fields.map((field, i) => (
                                        <DynamicInput
                                            key={`${field.name}-${i}`}
                                            label={field.label}
                                            value={values[field.name]}
                                            type={field.type}
                                            booleanActiveLabel={field.booleanActiveLabel}
                                            booleanInactiveLabel={field.booleanInactiveLabel}
                                            onChange={(value) => {
                                                /*
                                                 * La clave debe ser exactamente `field.name`, que es la
                                                 * que se lee arriba en `values[field.name]`: derivarla
                                                 * del ultimo segmento tras el punto escribia en otra
                                                 * clave para cualquier nombre con puntos.
                                                 */
                                                setFieldValue(
                                                    field.name,
                                                    filterBuilder(
                                                        field.type,
                                                        field.field,
                                                        value,
                                                        field.entity,
                                                        field.function,
                                                        field.alias,
                                                    ),
                                                );
                                            }}
                                        />
                                    ))}

                                    <Button type="submit" className={cn(fields.length > 3 && "col-span-2")}>
                                        {submitLabel || t("button.filter")}
                                    </Button>
                                </Form>
                            )}
                        </Formik>
                    </div>
                </DialogContent>
            </Portal>
        </Dialog>
    );
};

DataTableFilterModal.propTypes = {
    className: PropTypes.string,
    children: PropTypes.node,
    title: PropTypes.string,
    description: PropTypes.string,
    submitLabel: PropTypes.string,
    disabled: PropTypes.bool,
    initialValues: PropTypes.object,
    fields: PropTypes.arrayOf(
        PropTypes.shape({
            type: PropTypes.oneOfType(PropTypes.string),
            value: PropTypes.any,
            label: PropTypes.string,
            name: PropTypes.string,
        }),
    ),
    onSubmit: PropTypes.func,
};

export default DataTableFilterModal;
