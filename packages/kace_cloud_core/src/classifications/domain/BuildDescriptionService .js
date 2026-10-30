export function BuildDescriptionService(src) {
    const parts = [];
    for (let i = 1; i <= 10; i++) {
        const key = `nivel${i}`;
        const v = (src?.[key] ?? '').toString().trim();
        if (v) parts.push(v);
    }
    return parts.join(' -> ');
}
