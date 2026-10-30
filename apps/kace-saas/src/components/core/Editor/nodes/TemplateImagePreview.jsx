import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import useAttachmentsS3 from "../../Attachment/hooks/useAttachmentsS3";

export const TemplateImagePreview = ({ templateId, filename, mime, altText, width, height, onClick }) => {
    const { downloadFile } = useAttachmentsS3();
    const [previewUrl, setPreviewUrl] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setPreviewUrl(null);
        setFailed(false);

        downloadFile(templateId, { path: filename, type: mime }, "template", false).then((url) => {
            if (cancelled) return;
            if (url) {
                setPreviewUrl(url);
            } else {
                setFailed(true);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [templateId, filename, mime, downloadFile]);

    if (failed) {
        return (
            <span className="inline-flex items-center justify-center bg-gray-100 text-gray-400 text-xs border border-dashed border-gray-300 rounded-sm px-2 py-1">
                {altText || filename || "Imagen no disponible"}
            </span>
        );
    }

    if (!previewUrl) {
        return (
            <span
                className="inline-block animate-pulse bg-gray-100 rounded-sm"
                style={{ width: width || 100, height: height || 60 }}
            />
        );
    }

    /*
     * Freshly-uploaded images carry no width/height (Toolbar's handleImageFileSelected
     * doesn't set them), so without a cap a large photo renders at full natural
     * resolution and dominates the editor's fixed-height viewport. Templates that
     * already specify explicit dimensions (e.g. imported HTML) keep using those as-is.
     */
    const style = height ? { maxWidth: "100%" } : { maxWidth: "100%", maxHeight: 200, objectFit: "contain" };

    return (
        <img
            src={previewUrl}
            alt={altText}
            width={width}
            height={height}
            style={{ ...style, cursor: onClick ? "pointer" : undefined }}
            onClick={onClick}
        />
    );
};

TemplateImagePreview.propTypes = {
    templateId: PropTypes.string.isRequired,
    filename: PropTypes.string,
    mime: PropTypes.string,
    altText: PropTypes.string,
    width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    onClick: PropTypes.func,
};
