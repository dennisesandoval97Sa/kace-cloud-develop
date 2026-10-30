export const pathToObject = (path, value) => {
    const keys = path.split(".");
    const result = {};
    let current = result;

    keys.forEach((key, index) => {
        if (index === keys.length - 1) {
            current[key] = value;
        } else {
            current[key] = {};
            current = current[key];
        }
    });

    return result;
};
