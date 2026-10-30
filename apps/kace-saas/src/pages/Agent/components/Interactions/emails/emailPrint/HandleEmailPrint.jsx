import { useTranslation } from "react-i18next";
import { renderEmailToPrintHtml } from "./renderEmailToPrintHtml";

export const HandleEmailPrint = ({ email }) => {
    const { t } = useTranslation();

    return () => {
        if (!email) return;

        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";

        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <html>
                <head>
                    <title>Print</title>
                </head>
                <body>
                    ${renderEmailToPrintHtml({ email, t })}
                </body>
            </html>
        `);
        doc.close();

        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
    };
};
