const fs = require("fs");
const path = require("path");

/**
 * Recursively finds keys that exist in obj1 but are missing from obj2.
 * @param {object} obj1 The reference object.
 * @param {object} obj2 The object to compare against.
 *param {string} [currentPath=''] The current path for nested keys.
 * @returns {string[]} An array of paths to missing keys.
 */
function findMissingKeys (obj1, obj2, currentPath = "") {
    let missingKeys = [];

    for (const key in obj1) {
        if (Object.prototype.hasOwnProperty.call(obj1, key)) {
            const newPath = currentPath ? `${currentPath}.${key}` : key;

            if (obj2[key] === undefined) {
                missingKeys.push(newPath);
            } else if (typeof obj1[key] === "object" && obj1[key] !== null && typeof obj2[key] === "object" && obj2[key] !== null) {
                const nestedMissingKeys = findMissingKeys(obj1[key], obj2[key], newPath);
                missingKeys = missingKeys.concat(nestedMissingKeys);
            }
        }
    }

    return missingKeys;
}

/**
 * Reads and parses a JSON file.
 * @param {string} filePath The path to the JSON file.
 * @returns {object} The parsed JSON object.
 */
function readJsonFile (filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, "utf8");
        return JSON.parse(fileContent);
    } catch (error) {
        //NO-SONAR: Son para ayudar buscando traducciones
        console.error(`Error reading or parsing file: ${filePath}`);
        console.error(error);
        process.exit(1);
    }
}

function main () {
    const [file1Path, file2Path] = process.argv.slice(2);

    if (!file1Path || !file2Path) {
        // SONAR-EXC: NODEJS No expone logs porque es server-side
        console.log("Usage: node validate.js <file1.json> <file2.json>");
        process.exit(1);
    }
    // SONAR-EXC: NODEJS No expone logs porque es server-side
    console.log(`Comparing:`);
    console.log(`  File 1: ${file1Path}`);
    console.log(`  File 2: ${file2Path}\n`);

    const file1Json = readJsonFile(file1Path);
    const file2Json = readJsonFile(file2Path);

    const missingInFile2 = findMissingKeys(file1Json, file2Json);
    const missingInFile1 = findMissingKeys(file2Json, file1Json);

    let noIssues = true;

    if (missingInFile2.length > 0) {
        noIssues = false;
        // SONAR-EXC: NODEJS No expone logs porque es server-side
        console.log(`🔴 Keys missing from ${path.basename(file2Path)}:`);
        missingInFile2.forEach(key => console.log(`   - ${key}`));
        console.log("");
    }

    if (missingInFile1.length > 0) {
        noIssues = false;
        // SONAR-EXC: NODEJS No expone logs porque es server-side
        console.log(`🔴 Keys missing from ${path.basename(file1Path)}:`);
        missingInFile1.forEach(key => console.log(`   - ${key}`));
        console.log("");
    }

    if (noIssues) {
        // SONAR-EXC: NODEJS No expone logs porque es server-side
        console.log("✅ All keys match! The files are in sync.");
    }
}

main();
