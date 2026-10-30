export const emailPrintStyles = `
    * { box-sizing: border-box; }

    body {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        color: #111827;
        margin: 40px;
    }

    h1 {
        font-size: 18px;
        margin-bottom: 20px;
        font-weight: 600;
    }

    .meta {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px 24px;
        margin-bottom: 24px;
    }

    .meta-item {
        font-size: 12px;
        color: #374151;
    }

    .meta-item strong {
        font-weight: 600;
        color: #111827;
    }

    .content {
        background: #f9fafb;
        border-radius: 6px;
        padding: 16px;
        margin-bottom: 24px;
        line-height: 1.5;
    }

    .section-title {
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 8px;
        color: #374151;
    }

    .attachments {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .attachment {
        background: #f3f4f6;
        border-radius: 16px;
        padding: 6px 12px;
        font-size: 12px;
        color: #374151;
    }

    /* HTML EMAIL */
    .email-html p { margin: 0 0 10px; }
    .email-html table { width: 100%; border-collapse: collapse; }
    .email-html td,
    .email-html th { border: 1px solid #e5e7eb; padding: 6px; }
    .email-html img { max-width: 100%; height: auto; }
    .email-html a { color: #2563eb; text-decoration: underline; }
    .email-html blockquote {
        border-left: 3px solid #e5e7eb;
        padding-left: 12px;
        margin: 12px 0;
        color: #4b5563;
    }

    footer {
        margin-top: 40px;
        font-size: 10px;
        color: #9ca3af;
        text-align: right;
    }

    @media print {
        body { margin: 24px; }
    }
`;
