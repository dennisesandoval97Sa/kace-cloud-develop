const DEFAULT_ATTACHMENT_CONTENT_TYPE = "application/octet-stream";

const decodePathSegment = (segment) => {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
};

const getS3ObjectKeyParts = (attachmentUrl) => {
    const parsedUrl = new URL(attachmentUrl);
    const keyParts = parsedUrl.pathname.split("/").filter(Boolean).map(decodePathSegment);

    if (keyParts.length < 3) {
        throw new Error("invalid_attachment_s3_url");
    }

    const [url, id, ...fileNameParts] = keyParts;
    const fileName = fileNameParts.join("/");

    if (!url || !id || !fileName) {
        throw new Error("invalid_attachment_s3_url");
    }

    return { url, id, fileName };
};

export const buildS3FileDownloadPayload = (attachment) => {
    const keyParts = getS3ObjectKeyParts(attachment?.url);

    return {
        ...keyParts,
        contentType: attachment?.contentType || attachment?.tipo || attachment?.type || DEFAULT_ATTACHMENT_CONTENT_TYPE,
    };
};

// Note: /download-s3-files returns the presigned URL under `uploadUrl` regardless
// of whether it is used for download or upload — that is the backend's field name,
// not a sign that this is an upload flow.
export const getS3SignedDownloadUrl = (response) => response?.data?.data?.uploadUrl;
