import { Label } from "@kace/ui-shared";
import { PropTypes } from "prop-types";
import DOMPurify from 'dompurify';
import { useTranslation } from "react-i18next";
import { formatTestId } from "@/utils/src/helpers";


export const HelpsCard = ({ titulo, descripcion, attachments, color }) => {
    const { t } = useTranslation()
    return (
        <div className="bg-background p-4 shadow-xl rounded-md flex flex-col gap-4" style={{ backgroundColor: color }} id="helps_card_container"
            data-testid="helps_card_container">
            <Label className="font-semibold text-xl capitalize mt-2" id="helps_card_title_label"
                data-testid="helps_card_title_label">{`${t("helps.form.title")}`}:</Label>
            <Label className=" capitalize my-2" id={formatTestId("helps_card_title_value", `${titulo}`)}
                data-testid={formatTestId("helps_card_title_value", `${titulo}`)}>{titulo}</Label>
            <Label className="font-semibold text-xl capitalize mt-2" id="helps_card_description_label"
                data-testid="helps_card_description_label">{`${t("helps.form.description")}`}:</Label>
            <Label className="text-sm my-2" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(descripcion) }} id="helps_card_description_value"
                data-testid="helps_card_description_value" />
            {attachments.length > 0 && <Label className="font-semibold text-xl capitalize my-2" id="helps_card_attachments_label"
                data-testid="helps_card_attachments_label">{`${t("helps.form.attachments")}`}:</Label>}
            <div className="grid grid-cols-2 gap-4">
                {attachments.map((data) => (
                    <a
                        id={`helps_card_attachment_${data.url}`}
                        data-testid={`helps_card_attachment_${data.url}`}
                        key={data.url}
                        href={data.url}
                        target="_blank"
                        rel="noopener noreferrer" className="py-2" >
                        <div className="flex items-center justify-between border border-gray-300 rounded-md px-4 py-2 text-white w-full bg-gray-800">
                            <span className="text-sm truncate">{data.path}</span>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
};

HelpsCard.propTypes = {
    titulo: PropTypes.string.isRequired,
    descripcion: PropTypes.string.isRequired,
    attachments: PropTypes.array.isRequired,
};
