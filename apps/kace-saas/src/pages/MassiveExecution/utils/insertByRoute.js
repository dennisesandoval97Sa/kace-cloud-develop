export const insertByRoute = (obj, path, value) => {
    const keys = path.split("|").slice(1);
    let current = obj;

    keys.forEach((key, index) => {
        if (index === keys.length - 1) {
            current[key] = value;
        } else {
            if (!current[key] || typeof current[key] !== "object") {
                current[key] = {};
            }
            current = current[key];
        }
    });

    return obj;
};
