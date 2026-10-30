// Per-image cap for images inserted into a template body. The real guardrail against
// Gmail's ~102KB inline HTML clipping threshold is the aggregate budget enforced at send
// time (TEMPLATE_IMAGE_INLINE_MAX_BYTES_TOTAL in TemplateAttachmentInlineImageEmbedder.js);
// this cap only exists to reject absurdly large uploads (e.g. a raw photo), not to bound
// a single reasonable logo/banner.
export const TEMPLATE_IMAGE_MAX_BYTES = 300 * 1024;

export const TEMPLATE_IMAGE_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Cap applied to a newly-uploaded image's own width/height attributes (not just editor CSS)
// so the dimensions travel with the <img> tag into the saved template body and, from there,
// into the sent email — where no CSS/editor cap applies. Keeps a photographed/full-res upload
// from rendering at its native resolution in the recipient's inbox. Matches the editor
// preview's own maxHeight cap (TemplateImagePreview.jsx / ImageNode.jsx) so what the author
// sees while editing is what the recipient sees.
export const TEMPLATE_IMAGE_MAX_DISPLAY_WIDTH = 300;
export const TEMPLATE_IMAGE_MAX_DISPLAY_HEIGHT = 200;

export const DEFAULT_FIELDS_OPTIONS = [
    {
        text: "cases",
        schema: "cases",
        url: "cases",
    },
    {
        text: "clients",
        schema: "clients",
        url: "clients",
    },
    {
        text: "users",
        schema: "usuarios",
        url: "usuarios",
    },
    {
        text: "classifications",
        schema: "clasificaciones",
        url: "clasificaciones",
    },
    {
        text: "states",
        schema: "estados",
        url: "estados",
    },
    {
        text: "aux_cases",
        schema: "aux_cases",
        url: "aux_cases",
    },
    {
        text: "aux_clients",
        schema: "aux_clients",
        url: "aux_clients",
    },
];
