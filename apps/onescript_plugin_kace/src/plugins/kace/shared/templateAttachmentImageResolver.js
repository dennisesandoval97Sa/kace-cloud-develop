const IMG_TAG_RE = /<img\b([^>]*)>/gi;
const TEMPLATE_ATTACHMENT_SRC_RE =
  /\bsrc\s*=\s*["']template-attachment:\/\/([^"']+)["']/i;
const DATA_FILENAME_RE = /\bdata-filename\s*=\s*["']([^"']*)["']/i;
const DATA_MIME_RE = /\bdata-mime\s*=\s*["']([^"']*)["']/i;

/**
 * Replaces <img src="template-attachment://{id}" data-filename="..." data-mime="...">
 * placeholders (left by the backend template renderer for inline attachment
 * images) with a presigned S3 download URL from /download-s3-files. Tags
 * missing an id/filename, or whose request fails, are left untouched.
 *
 * Resolves the template-attachment:// scheme wherever it shows up in HTML —
 * not exclusively "email templates" as a domain concept:
 *  - useEmailForm.js: the template body being composed.
 *  - useReceivedEmail.js: the "received email" panel, which for a message
 *    resolved via interactionId can be the agent's own outbound reply (that
 *    search path has no is_outbound filter — see buildSearchPayload). If the
 *    backend echoes that reply's body back unresolved, it can still carry
 *    these placeholders. NOT CONFIRMED with backend/product — flagged as an
 *    open question, not a verified contract.
 *
 * @param {string} html
 * @param {{ post: (path: string, body: object) => Promise<any> }} apiService
 * @returns {Promise<string>}
 */
export async function resolveTemplateAttachmentPlaceholders(html, apiService) {
  const tags = [...html.matchAll(IMG_TAG_RE)].filter((m) =>
    TEMPLATE_ATTACHMENT_SRC_RE.test(m[0])
  );
  if (!tags.length) return html;

  const replacements = await Promise.all(
    tags.map(async (m) => {
      const tag = m[0];
      const templateId = tag.match(TEMPLATE_ATTACHMENT_SRC_RE)?.[1];
      const filename = tag.match(DATA_FILENAME_RE)?.[1];
      if (!templateId || !filename) return { tag, replacement: tag };
      try {
        const mime = tag.match(DATA_MIME_RE)?.[1];
        const res = await apiService.post('/download-s3-files', {
          id: templateId,
          contentType: mime,
          fileName: filename,
          url: 'template',
        });
        const url = res?.data?.data?.uploadUrl;
        if (!url) return { tag, replacement: tag };
        return {
          tag,
          replacement: tag.replace(TEMPLATE_ATTACHMENT_SRC_RE, `src="${url}"`),
        };
      } catch (error) {
        console.warn(
          '[resolveTemplateAttachmentPlaceholders] Failed to resolve inline image, leaving placeholder unresolved:',
          { templateId, filename, status: error?.response?.status }
        );
        return { tag, replacement: tag };
      }
    })
  );

  let result = html;
  for (const { tag, replacement } of replacements) {
    result = result.replace(tag, replacement);
  }
  return result;
}
