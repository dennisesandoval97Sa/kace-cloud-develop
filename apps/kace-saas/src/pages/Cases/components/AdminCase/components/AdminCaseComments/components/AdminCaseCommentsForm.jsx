import { Button } from "@kace/ui-shared"
import { joiFormikAdapter } from "@kace/utils"
import { Form, Formik } from "formik"
import { Pen } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { RichEditor } from "../../../../../../../components/core/Editor/Editor"
import { CommentsCreateSchema } from "../../../../../../../schemas/CommentSchema"
import { EMOJI_LIST } from "../../../../../data/Constants"
import useAdminCaseComments from "../hooks/useAdminCaseComments"

export const CommentsForm = () => {
    const [editorKey, setEditorKey] = useState(0)
    const { dataHandler, sending } = useAdminCaseComments()
    const { t } = useTranslation()

    return (
        <Formik
            enableReinitialize={true}
            initialValues={{
                descripcion: "",
                calificacion: 5
            }}
            validationSchema={joiFormikAdapter(CommentsCreateSchema)}
            onSubmit={(values, { resetForm }) => {
                dataHandler(values)
                resetForm()
                setEditorKey((prev) => prev + 1)
            }}
        >
            {({ setFieldValue, values, errors, touched }) => (
                <Form className="h-full grid p-2 grid-cols-1" autoComplete="off" id="comments_form" data-testid="comments_form">
                    <div className="col-span-12 mx-2 row-span-1" id="comments_form_editor_container" data-testid="comments_form_editor_container">
                        <div className="min-h-[1.5rem] text-red-500" id="comments_form_error" data-testid="comments_form_error">
                            {touched.descripcion && errors.descripcion ? errors.descripcion : null}
                        </div>
                        <RichEditor
                            key={`editor-${editorKey}`}
                            name="descripcion"
                            setValue={(_, value) => {
                                setFieldValue("descripcion", value)
                            }}
                            id="comments_form_editor"
                            data-testid="comments_form_editor"
                        />
                    </div>

                    <div className="flex flex-col justify-center items-center gap-4 p-2" id="comments_form_emoji_section" data-testid="comments_form_emoji_section">
                        <div className="flex flex-wrap item-center justify-center" id="comments_form_emoji_list" data-testid="comments_form_emoji_list">
                            {EMOJI_LIST.map((item) => (
                                <div className="mx-2" key={item.value} id={`emoji_item_${item.value}`} data-testid={`emoji_item_${item.value}`}>
                                    <Button
                                        type="button"
                                        className={`max-sm:h-10 max-sm:w-10 h-16 w-16 p-0 bg-background hover:bg-background ${values.calificacion === item.value
                                            ? `bg-${item.color} max-sm:h-10 max-sm:w-10 h-16 w-16 hover:bg-${item.color}`
                                            : ""
                                            }`}
                                        id={`btn_emoji_list_${item.value}`}
                                        data-testid={`btn_emoji_list_${item.value}`}
                                        onClick={() => {
                                            setFieldValue(
                                                "calificacion",
                                                item.value
                                            )
                                        }}
                                    >
                                        {item.icon}
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-center item-center gap-2" id="comments_form_submit_section" data-testid="comments_form_submit_section">
                            <Button
                                type="submit"
                                className="flex gap-2"
                                disabled={sending}
                                id="btn_comments_form_submit"
                                data-testid="btn_comments_form_submit"
                            >
                                <Pen />
                                {sending
                                    ? t("case.comments.creating")
                                    : t("case.comments.addNew")
                                }
                            </Button>
                        </div>
                    </div>
                </Form>
            )}
        </Formik>
    )
}
