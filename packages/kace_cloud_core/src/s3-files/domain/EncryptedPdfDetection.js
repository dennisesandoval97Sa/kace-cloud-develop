const ENCRYPTED_PDF_PATTERN = /encrypted|password[- ]protected|standard security handler|aes-256|rc4-128/i;

export function isEncryptedPdfDescription(description, fileName) {
    const normalizedDescription = String(description ?? '');
    const identifiesPdf = /\.pdf$/i.test(String(fileName)) || /\bpdf\b/i.test(normalizedDescription);

    return identifiesPdf && ENCRYPTED_PDF_PATTERN.test(normalizedDescription);
}
