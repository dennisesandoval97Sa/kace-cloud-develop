export class XSSDictionary {
    /**
     * A set of known XSS patterns.
     */
    static prohibitedSet = new Set([...XSSDictionary.prohibitedWords(), ...XSSDictionary.prohibitedEventHandlers()]);

    /**
     * Checks if the given value contains any XSS patterns.
     *
     * @param {string} value - The input string to be checked for XSS patterns.
     * @returns {Array<string>} An array of detected XSS patterns, or empty if the input is not a string.
     */
    static findXSSPatterns (value) {
        if (typeof value !== "string") return [];

        const tokens = XSSDictionary.tokenize(value);

        const matches = tokens.filter((token) => XSSDictionary.prohibitedSet.has(token));

        return [...new Set(matches)];
    }

    /**
     * Tokenizes the input text by splitting it into an array of words.
     *
     * @param {string} text - The input text to be tokenized.
     *
     * @returns {Array<string>} An array of words extracted from the input text.
     */
    static tokenize (text) {
        return text
            .toLowerCase()
            .split(/[\s<>"'()=;:]+/) // SONAR-EXC:This regex is used to split the input text into words.
            .filter(Boolean);
    }

    /**
     * Sanitizes the input string by escaping special characters.
     *
     * @param {string} input - The input string to be sanitized.
     * @returns {string} The sanitized string with special characters replaced by HTML entities.
     */
    static sanitize (input) {
        return input.replace(/[&<>"']/g, (char) => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#x27;",
            };
            return entities[char];
        });
    }

    /**
     * Retrieves a list of patterns known to be associated with XSS attacks.
     *
     * @returns {Array<string>} An array of prohibited patterns related to XSS.
     */
    static prohibitedWords () {
        return [
            "<script>",
            "javascript",
            "<script",
            "script",
            "iframe",
            "<font",
            "eval(",
            "eval (",
            "<body",
            "vbscript:",
            "data:",
            "<iframe",
            "<img",
            "src =",
            "src=",
            "window.open",
            "%3Cscript",
            "alert(",
            "<a",
            "<embed",
            "javascript:",
            "<form",
            "<input",
            "<meta",
            "<object",
            "<var",
            "<svg",
            "<textarea",
            "alert%28",
            "<link",
            "function()",
            "exploit",
            "document.getelementbyid",
            "xmlhttp.open",
            "c:\\windows\\system",
            "open(",
            "open (",
            "href=",
            "href =",
            "data:text",
            "document.write",
            "&gt",
            "&lt",
            "&lt;",
            "&#",
            "&#x",
        ];
    }

    /**
     * Retrieves a list of name events known to be associated with XSS attacks.
     *
     * @returns {Array<string>} An array of prohibited patterns related to XSS.
     */
    static prohibitedEventHandlers () {
        return [
            "onabort",
            "onblur",
            "onchange",
            "onclick",
            "ondblclick",
            "ondragdrop",
            "onerror",
            "onfocus",
            "onkeydown",
            "onkeypress",
            "onkeyup",
            "onload",
            "onmousedown",
            "onmousemove",
            "onmouseout",
            "onmouseover",
            "onmouseup",
            "onmove",
            "onreset",
            "onresize",
            "onselect",
            "onsubmit",
            "onactivate",
            "onafterprint",
            "onafterupdate",
            "onanimationend",
            "onanimationiteration",
            "onanimationstart",
            "onautocomplete",
            "onautocompleteerror",
            "onbeforeactivate",
            "onbeforecopy",
            "onbeforecut",
            "onbeforedeactivate",
            "onbeforeeditfocus",
            "onbeforepaste",
            "onbeforeprint",
            "onbeforeunload",
            "onbeforeupdate",
            "onbegin",
            "onbounce",
            "oncancel",
            "oncanplay",
            "oncanplaythrough",
            "oncellchange",
            "onclose",
            "oncompassneedscalibration",
            "oncontextmenu",
            "oncontrolselect",
            "oncopy",
            "oncuechange",
            "oncut",
            "ondataavailable",
            "ondatasetchanged",
            "ondatasetcomplete",
            "ondeactivate",
            "ondevicelight",
            "ondevicemotion",
            "ondeviceorientation",
            "ondeviceproximity",
            "ondrag",
            "ondragend",
            "ondragenter",
            "ondragexit",
            "ondragleave",
            "ondragover",
            "ondragstart",
            "ondrop",
            "ondurationchange",
            "onemptied",
            "onend",
            "onended",
            "onerrorupdate",
            "onexit",
            "onfilterchange",
            "onfinish",
            "onfocusin",
            "onfocusout",
            "onformchange",
            "onforminput",
            "ongesturechange",
            "ongestureend",
            "ongesturestart",
            "onhashchange",
            "onhelp",
            "oninput",
            "oninvalid",
            "onlanguagechange",
            "onlayoutcomplete",
            "onloadeddata",
            "onloadedmetadata",
            "onloadstart",
            "onlosecapture",
            "onmediacomplete",
            "onmediaerror",
            "onmessage",
            "onmouseenter",
            "onmouseleave",
            "onmousewheel",
            "onmoveend",
            "onmovestart",
            "onmozfullscreenchange",
            "onmozfullscreenerror",
            "onmozpointerlockchange",
            "onmozpointerlockerror",
            "onmsgesturechange",
            "onmsgesturedoubletap",
            "onmsgesturehold",
            "onmsgesturerestart",
            "onmsinertiastart",
            "onmspointercancel",
            "onmspointerdown",
            "onmspointerenter",
            "onmspointerhover",
            "onmspointerleave",
            "onmspointermove",
            "onmspointerout",
            "onmspointerover",
            "onmspointerup",
            "onoffline",
            "ononline",
            "onorientationchange",
            "onoutofsync",
            "onpagehide",
            "onpageshow",
            "onpaste",
            "onpause",
            "onplay",
            "onplaying",
            "onpopstate",
            "onprogress",
            "onpropertychange",
            "onratechange",
            "onreadystatechange",
            "onreceived",
            "onrepeat",
            "onresizeend",
            "onresizestart",
            "onresume",
            "onreverse",
            "onrowdelete",
            "onrowenter",
            "onrowexit",
            "onrowinserted",
            "onrowsdelete",
            "onrowsinserted",
            "onscroll",
            "onsearch",
            "onseek",
            "onseeked",
            "onseeking",
            "onselectionchange",
            "onselectstart",
            "onshow",
            "onstalled",
            "onstart",
            "onstop",
            "onstorage",
            "onsuspend",
            "onsynchrestored",
            "ontimeerror",
            "ontimeupdate",
            "ontoggle",
            "ontouchcancel",
            "ontouchend",
            "ontouchmove",
            "ontouchstart",
            "ontrackchange",
            "ontransitionend",
            "onunload",
            "onurlflip",
            "onuserproximity",
            "onvolumechange",
            "onwaiting",
            "onwebkitanimationend",
            "onwebkitanimationiteration",
            "onwebkitanimationstart",
            "onwheel",
            "onwebkitmouseforcechanged",
            "onwebkitmouseforcedown",
            "onwebkitmouseforceup",
            "onzoom",
            "onwebkitmouseforcewillbegin",
            "onwebkittransitionend",
            "onwebkitwillrevealbottom",
        ];
    }
}
