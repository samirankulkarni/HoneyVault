import { exec } from "child_process";
import path from "path";

// Function to execute a script
function executeScript(scriptPath) {
    return new Promise((resolve, reject) => {
        exec(`node ${scriptPath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing ${scriptPath}:`, error);
                reject(error);
                return;
            }
            if (stderr) {
                console.error(`Stderr from ${scriptPath}:`, stderr);
            }
            console.log(`Output from ${scriptPath}:\n${stdout}`);
            resolve();
        });
    });
}

// Paths to the scripts
const scripts = [
    path.join(process.cwd(), "cloud_server", "cleanup.js"),
    path.join(process.cwd(), "genai", "cleanup.js"),
    path.join(process.cwd(), "on_prem_server", "cleanup.js"),
];

// Sequentially execute the scripts
async function executeScriptsSequentially() {
    try {
        for (const script of scripts) {
            console.log(`Executing: ${script}`);
            await executeScript(script);
        }
        console.log("All scripts executed successfully.");
    } catch (error) {
        console.error("An error occurred during script execution:", error);
    }
}

// Run the scripts
executeScriptsSequentially();
