import { describe, expect, it } from "vitest";
import en from "./en.json?raw";
import es from "./es.json?raw";
import i18n from "./i18n";

const LOCALE_FILES = { "en.json": en, "es.json": es };
const KEY_SEPARATOR = /\s*:/y;

/*
 * JSON.parse se queda con la última aparición de una clave repetida, así que el
 * duplicado no se ve desde el objeto parseado: se busca recorriendo el texto.
 */
const findDuplicateKeys = (text) => {
    const duplicates = [];
    const stack = [];
    const path = [];
    let index = 0;

    const readString = () => {
        const start = index;
        index++;
        while (index < text.length && text[index] !== '"') {
            index += text[index] === "\\" ? 2 : 1;
        }
        index++;
        return JSON.parse(text.slice(start, index));
    };

    while (index < text.length) {
        const char = text[index];
        if (char === '"') {
            const value = readString();
            KEY_SEPARATOR.lastIndex = index;
            const scope = stack.at(-1);
            if (scope instanceof Set && KEY_SEPARATOR.test(text)) {
                if (scope.has(value)) duplicates.push([...path.slice(0, stack.length - 1), value].join("."));
                scope.add(value);
                path[stack.length - 1] = value;
            }
            continue;
        }
        if (char === "{") stack.push(new Set());
        if (char === "[") stack.push(null);
        if (char === "}" || char === "]") {
            stack.pop();
            path.length = stack.length;
        }
        index++;
    }

    return duplicates;
};

describe("locale files", () => {
    it.each(Object.entries(LOCALE_FILES))("%s has no duplicate keys", (_file, text) => {
        expect(findDuplicateKeys(text)).toEqual([]);
    });

    it("detects a key repeated inside the same object", () => {
        expect(findDuplicateKeys('{"a": {"b": "{x}", "c": "\\"", "b": "y"}, "b": "z"}')).toEqual(["a.b"]);
    });

    it("labels the Broker submenu in English", () => {
        const t = i18n.getFixedT("en");

        expect(t("navbar.broker_adapters")).toBe("Adapters");
        expect(t("navbar.broker_mappers")).toBe("Mappers");
    });
});
