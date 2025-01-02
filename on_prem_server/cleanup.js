const fs = require('fs');
const path = require('path');

// Define the paths to the directories that need to be cleaned up
const VAULTS_PATH = path.join(__dirname, 'data', 'vaults');
const MASTER_PATH = path.join(__dirname, 'data', 'master');
const ALERTS_PATH = path.join(__dirname, 'data', 'alerts');
const CloudDB_PATH = path.join(__dirname, 'data', 'cloudDB');

// Function to clear a directory at the file system level
function clearDirectory(dirPath) {
    fs.readdir(dirPath, (err, files) => {
        if (err) return console.error(`Error reading directory ${dirPath}: ${err.message}`);

        // Loop through all the files in the directory and delete them
        files.forEach(file => {
            const filePath = path.join(dirPath, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return console.error(`Error accessing file ${filePath}: ${err.message}`);

                if (stats.isDirectory()) {
                    // If it's a directory, call the cleanup function recursively
                    clearDirectory(filePath);
                } else {
                    // If it's a file, delete it
                    fs.unlink(filePath, (err) => {
                        if (err) return console.error(`Error deleting file ${filePath}: ${err.message}`);
                        console.log(`Deleted file: ${filePath}`);
                    });
                }
            });
        });
    });
}

// Function to clean up the necessary directories
function cleanup() {
    console.log('Starting cleanup process...');

    // Clear the vaults directory
    clearDirectory(VAULTS_PATH);

    // Clear the master directory
    clearDirectory(MASTER_PATH);

    clearDirectory(ALERTS_PATH);

    clearDirectory(CloudDB_PATH);

    console.log('Cleanup process completed.');
}

// Run the cleanup function
cleanup();
