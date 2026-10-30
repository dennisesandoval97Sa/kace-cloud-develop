import { ClientJS } from "clientjs";

let clientInstance = null;
let cachedFingerprint = null;

const getClientFingerprint = async () => {
    if (cachedFingerprint) {
        return cachedFingerprint;
    }

    if (!clientInstance) {
        clientInstance = new ClientJS();
    }

    const components = [
        clientInstance.getUserAgent(),
        clientInstance.getBrowser(),
        clientInstance.getBrowserVersion(),
        clientInstance.getDevice(),
        clientInstance.getDeviceType(),
        clientInstance.getDeviceVendor(),
        clientInstance.getOS(),
        clientInstance.getOSVersion(),
        clientInstance.getScreenPrint(),
        clientInstance.getColorDepth(),
        clientInstance.getTimeZone(),
        clientInstance.getLanguage(),
        navigator.hardwareConcurrency || "unknown",
        navigator.maxTouchPoints || 0,
    ];

    try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        ctx.textBaseline = "top";
        ctx.font = "14px Arial";
        ctx.fillText("KACE-fingerprint-test", 2, 2);
        components.push(canvas.toDataURL().slice(-50));
    } catch (e) {
        components.push("canvas-unavailable");
    }

    try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl");
        if (gl) {
            const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
            if (debugInfo) {
                components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
                components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
            }
        }
    } catch (e) {
        components.push("webgl-unavailable");
    }

    const fingerprint = await hashComponents(components);
    cachedFingerprint = fingerprint;

    return fingerprint;
};

const hashComponents = async (components) => {
    const str = components.join("|||");
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
};


export default getClientFingerprint;