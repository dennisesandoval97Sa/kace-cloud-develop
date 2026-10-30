import { PropTypes } from "prop-types"
import { Formik, Form } from "formik"
import { useEffect, useState } from "react"
import { joiFormikAdapter } from "@kace/utils"
import { BannerCreateSchemaForm } from "../../../schemas/BannersSchema"

import FormCard from "../../../components/core/Cards/FormCard"
import InputCard from "../../../components/core/Cards/InputCard"
import SectionForm from "../../../components/core/Cards/section-form"
import { SelectColor } from "../../../components/core/SelectColor/select-color"
import {
    COLORS_BANNER,
    POSITIONS_BANNER,
    SITE_TO_SHOW_BANNER
} from "../data/constants"
import {
    KField,
    TextAreaForm as Textarea,
    SelectForm as Select,
    DatePicker,
    Button,
    FormikStatusMessages,
} from "@kace/ui-shared"
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin"
import { useTranslation } from "react-i18next"

import { toast } from "sonner"
import { MultiSelectGroups } from "../../../components/core/multiselector/MultiSelectGroups"
import withDateValidation from "./withDateValidation"
import { cn } from "../../../components/ui-shared"
import { SelectIcon } from "../../../components/core/SelectIcon/SelectIcon"
import { ICONS_SELECT } from "../../../components/ui-shared/src/icons"
import MultiSelectUsers from "@/componentsV2/lib/MultiSelectUsers"
import { formatTestId } from "@/utils/src/helpers"

const DatePickerWithValidation = withDateValidation(DatePicker)

const BannersForm = ({ dataHandler, data = {}, isSending = false }) => {
    const [formData, setFormData] = useState(data)
    const [groups, setGroups] = useState([])
    const [groupsData, setGroupsData] = useState([])
    const [showBanner, setShowBanner] = useState(false)
    const { t } = useTranslation()

    const previewBanner = (data = []) => {
        if (
            data.propiedades.position === "" ||
            data.propiedades.icon === "" ||
            data.propiedades.color === "" ||
            data.descripcion === ""
        ) {
            toast.error(`${t("banners.alerts.previewBanners")}`)
            return
        }
        setShowBanner(!showBanner)
    }

    useEffect(() => {
        if (Object.entries(data).length !== 0) {
            Object.entries(data).forEach(([key, value]) => {
                if (key === "fecha_inicio" || key === "fecha_fin") {
                    const dateValue = value ? new Date(value) : null
                    setFormData((state) => ({
                        ...state,
                        [key]: dateValue
                            ? new Date(
                                dateValue.getUTCFullYear(),
                                dateValue.getUTCMonth(),
                                dateValue.getUTCDate(),
                                dateValue.getUTCHours(),
                                dateValue.getUTCMinutes(),
                                dateValue.getUTCSeconds()
                            )
                            : ""
                    }))
                } else {
                    setFormData((state) => ({
                        ...state,
                        [key]: value || ""
                    }))
                }
            })
            if (data.especificaciones.groups !== null) {
                const valuesGroups = data.especificaciones.groups.map((id) => ({ id }))
                setGroupsData(valuesGroups)
            }
        }
    }, [data])

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formData}
            validationSchema={joiFormikAdapter(BannerCreateSchemaForm)}
            onSubmit={async (values, { setErrors, setStatus }) => {
                values.especificaciones.groups = groups.map((item) => item.id)
                dataHandler(values, setErrors, setStatus)
            }}
        >
            {({ values, setFieldValue, errors, touched, status }) => {
                const animationDuration = `${20 + values.descripcion.length / 30}s`
                return (
                    <>
                        <Form className="flex w-full justify-center" autoComplete="off">
                            <FormCard
                                isId={Boolean(data?.id)}
                                title={t("app.title.banners")}
                                isSending={isSending}
                            >
                                <div className="flex flex-col col-span-3 gap-8">
                                    <FormikStatusMessages formikStatus={status} />
                                    <SectionForm
                                        title={t("banners.form.information")}
                                    >
                                        <InputCard>
                                            <DatePickerWithValidation
                                                onChange={(values) =>
                                                    setFieldValue(
                                                        "fecha_inicio",
                                                        values
                                                    )
                                                }
                                                value={values.fecha_inicio}
                                                placeholder={t(
                                                    "genericTexts.initialDate"
                                                )}
                                                label={t(
                                                    "genericTexts.labelStartDate"
                                                )}
                                                error={
                                                    errors.fecha_inicio &&
                                                    touched.fecha_inicio
                                                }
                                                errorMessage={
                                                    errors.fecha_inicio
                                                }
                                                id={formatTestId("banner_form", `${values.fecha_inicio}`)}
                                                data-testid={formatTestId("banner_form", `${values.fecha_inicio}`)}
                                            />
                                        </InputCard>
                                        <InputCard>
                                            <DatePickerWithValidation
                                                onChange={(values) =>
                                                    setFieldValue(
                                                        "fecha_fin",
                                                        values
                                                    )
                                                }
                                                value={values.fecha_fin}
                                                placeholder={t(
                                                    "genericTexts.endDate"
                                                )}
                                                label={t(
                                                    "genericTexts.labelEndDate"
                                                )}
                                                startDate={values.fecha_inicio}
                                                endDate={values.fecha_fin}
                                                error={
                                                    errors.fecha_fin &&
                                                    touched.fecha_fin
                                                }
                                                errorMessage={errors.fecha_fin}
                                            />
                                        </InputCard>
                                        <InputCard>
                                            <KField>
                                                <Textarea
                                                    name="descripcion"
                                                    label={t(
                                                        "banners.form.description"
                                                    )}
                                                    placeholder={t(
                                                        "banners.placeholder.description"
                                                    )}
                                                    className="flex flex-col items-start justify-start text-start"
                                                    id="banner_form_descripcion"
                                                    data-testid="banner_form_descripcion"
                                                />
                                            </KField>
                                        </InputCard>
                                    </SectionForm>
                                    <SectionForm
                                        title={t("banners.form.groups")}
                                        id="banner_group"
                                        dataTestId="banner_group"
                                    >
                                        <MultiSelectGroups
                                            listValues={groups}
                                            setListValues={setGroups}
                                            values={
                                                groupsData
                                            }
                                        />
                                    </SectionForm>
                                    <SectionForm
                                        title="Usuarios"
                                        id="banner_users"
                                        dataTestId="banner_users"
                                    >
                                        <MultiSelectUsers
                                            initialUsersValues={values.especificaciones.users}
                                            setUsersData={(users)=>setFieldValue("especificaciones.users", users.map(user=>user.id))}
                                        />
                                    </SectionForm>
                                    {data.id && (
                                        <SectionForm dataTestId="banner_status" id="banner_status"
                                        >
                                            <InputCard>
                                                <KField>
                                                    <SwitchStateAdmin name="status" />
                                                </KField>
                                            </InputCard>
                                        </SectionForm>
                                    )}
                                </div>
                                <div className="flex flex-col gap-8 col-start-4 col-span-2">
                                    <SectionForm
                                        title={t("banners.form.properties")}
                                        dataTestId="banner_properties"
                                        id="banner_properties"
                                    >
                                        <InputCard>
                                            <KField>
                                                <SelectColor
                                                    title={t(
                                                        "banners.form.color"
                                                    )}
                                                    name="propiedades[color]"
                                                    colors={COLORS_BANNER}
                                                    className="flex flex-col items-start justify-start text-start"
                                                />
                                            </KField>
                                        </InputCard>
                                        <SelectIcon
                                            title={t("states.form.iconos")}
                                            name="propiedades[icon]"
                                            className="flex flex-col items-start justify-start text-start gap-2"
                                        />
                                        <InputCard>
                                            <KField>
                                                <Select
                                                    placeholder={t(
                                                        "banners.form.position"
                                                    )}
                                                    name="propiedades[position]"
                                                    options={POSITIONS_BANNER}
                                                    label={t(
                                                        "banners.form.position"
                                                    )}
                                                    className="flex flex-col  items-start justify-start text-start"
                                                    id="banner_position"
                                                    data-testid="banner_select_position"
                                                />
                                            </KField>
                                        </InputCard>
                                        <InputCard>
                                            <KField>
                                                <Select
                                                    placeholder="Mostrar banner en"
                                                    name="propiedades[siteToShow]"
                                                    options={SITE_TO_SHOW_BANNER}
                                                    label="Mostrar banner en"
                                                    className="flex flex-col  items-start justify-start text-start"
                                                    id="banner_select_display_banner_in"
                                                />
                                            </KField>
                                        </InputCard>
                                        <InputCard>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() =>
                                                    previewBanner(values)
                                                }
                                                id={formatTestId("btn_banner_form", `${!showBanner
                                                    ? t("button.preview")
                                                    : t("button.hidePreview")}`)}
                                                data-testid={formatTestId("btn_banner_form", `${!showBanner
                                                    ? t("button.preview")
                                                    : t("button.hidePreview")}`)}
                                            >
                                                {!showBanner
                                                    ? t("button.preview")
                                                    : t("button.hidePreview")}
                                            </Button>
                                        </InputCard>
                                    </SectionForm>
                                </div>
                            </FormCard>
                        </Form >
                        {showBanner && (() => {
                            const IconComponent = ICONS_SELECT.find((icon) => icon.name === values.propiedades.icon)?.component
                            return (
                                <div
                                    className={cn(
                                        "h-auto fixed left-0 z-50 w-full",
                                        values.propiedades.position === "top-center"
                                            ? "top-0"
                                            : "bottom-0"
                                    )}
                                    style={{
                                        backgroundColor: values.propiedades.color
                                    }}
                                    id="display_show_banner"
                                    data-testid="display_show_banner"
                                >
                                    <div className="info-bar">
                                        <p
                                            style={{
                                                animation: `scroll-text ${animationDuration} linear infinite`,
                                                display: "flex",
                                                gap: "8px",
                                                minWidth: "100%"
                                            }}
                                            className="flex items-center"
                                        >
                                            {IconComponent && (
                                                <span>
                                                    <IconComponent className="h-5 w-5" />
                                                </span>
                                            )}
                                            <span>{values.descripcion}</span>
                                        </p>
                                    </div>
                                </div>
                            )
                        })()
                        }

                    </>
                )
            }}
        </Formik >
    )
}
BannersForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool
}
export default BannersForm
