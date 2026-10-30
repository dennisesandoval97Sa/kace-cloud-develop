/*
 * Template body images inserted before the template exists (create flow) are
 * previewed via a local `URL.createObjectURL` blob: URL (see Toolbar's
 * handleImageFileSelected) and later re-uploaded for real once the template
 * has an id (see TemplatesUpdateHandler's resolveInlinePendingImages).
 *
 * That second step used to reconstruct the File by `fetch(blobUrl)`, but
 * fetching a blob: URL is subject to the page's CSP `connect-src` directive
 * in Chromium - and this app's CSP does not (and should not, for an
 * unrelated `blob:` fetch that never leaves the browser) whitelist `blob:`,
 * so the fetch was silently blocked, breaking every template created with a
 * body image ("Refused to connect to 'blob:...'").
 *
 * The File object already exists in memory at the moment the blob: URL is
 * created, so instead of fetching it back, register it here and fetch it
 * from this in-memory map - no network/CSP involvement at all.
 */
const pendingBlobFiles = new Map();

export const registerPendingBlobFile = (blobUrl, file) => {
    pendingBlobFiles.set(blobUrl, file);
};

export const takePendingBlobFile = (blobUrl) => {
    const file = pendingBlobFiles.get(blobUrl);
    pendingBlobFiles.delete(blobUrl);
    return file;
};
