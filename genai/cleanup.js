import fs from 'fs';

/**
 * Cleans the content of a file by truncating it.
 * @param {string} filePath - The path to the file to clean.
 */
function cleanFile(filePath) {
    fs.truncate(filePath, 0, (err) => {
        if (err) {
            console.error(`Error cleaning file: ${filePath}`);
            console.error(err.message);
        } else {
            console.log(`File cleaned successfully: ${filePath}`);
        }
    });
}

const filePath = './genai_server_logs.txt'; // Replace with your file path
cleanFile(filePath);