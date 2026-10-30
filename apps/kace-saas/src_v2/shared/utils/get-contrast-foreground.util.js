export function getContrastForeground(hex) {
    if (!hex || typeof hex !== "string") return "#000";
    const raw = hex.trim().startsWith("#") ? hex.trim().slice(1) : hex.trim();
    if (raw.length !== 6) return "#000";
    const n = Number.parseInt(raw, 16);
    if (!Number.isFinite(n)) return "#000";
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 186 ? "#000" : "#fff";
}
