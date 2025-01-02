const { Db } = require('tingodb')();
const CryptoJS = require('crypto-js');
const path = require('path');
const axios = require('axios');

// Directory paths
const DATA_DIR = path.join(__dirname, 'data');
const MASTER_PATH = path.join(DATA_DIR, 'master');
const VAULTS_PATH = path.join(DATA_DIR, 'vaults');

// Initialize databases
const masterDb = new Db(MASTER_PATH, {});

const API_BASE_URL = 'http://localhost:45107/api';

// Helper function to log errors
function logError(message) {
    console.error(`[ERROR]: ${message}`);
}

// Helper function to generate random alphanumeric string
function generateRandomKey(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Function to encrypt data
function encrypt(data, key) {
    return CryptoJS.AES.encrypt(data, key).toString();
}

// Function to decrypt data
function decrypt(encryptedData, key) {
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    return bytes.toString(CryptoJS.enc.Utf8);
}

async function getGenAIPasswords(credName, secret) {
    const response = await fetch(`http://localhost:44518/api/list?secret=${encodeURIComponent(secret)}&cred=${encodeURIComponent(credName)}`);
    if (!response.ok) {
        throw new Error('Failed to get passwords from Gen AI server');
    }
    const passwordArray = await response.json();
    return passwordArray;
}

// Function to create a new vault
function createVault(vaultName, masterKey) {
    const vaultDb = new Db(VAULTS_PATH, {});
    if (!/^[a-zA-Z0-9]+$/.test(vaultName)) {
        logError(`Invalid vault name: ${vaultName}`);
        return;
    }

    masterDb.collection('master').insert({ vaultName, masterKey }, (err) => {
        if (err) return logError(`Failed to create vault: ${err.message}`);
        console.log(`Vault "${vaultName}" created successfully.`);
    });

    vaultDb.collection(vaultName); // Initialize vault collection
}

function addEntry(vaultName, masterKey, name, secret, value) {
    const vaultDb = new Db(VAULTS_PATH, {});
    const vault = vaultDb.collection(vaultName);

    masterDb.collection('master').findOne({ vaultName, masterKey }, async (err, vaultInfo) => {
        if (err || !vaultInfo) return logError('Invalid master key or vault.');

        // Generate unique encryption key for real entry
        const realEncryptionKey = generateRandomKey(20);
        const encryptedValue = encrypt(value, realEncryptionKey);

        // Real entry
        const realEntry = { name, secret, value: encryptedValue };
        const realCloudEntry = { 
            vaultName, 
            name, 
            secret, 
            key: realEncryptionKey, 
            isReal: 1 
        };

        // Fake entries with unique keys
        const similarPasswords = await getGenAIPasswords(name, secret);
        // const fakeEntries = Array(9).fill().map(() => {
        //     const fakeSecret = generateRandomKey(secret.length);
        //     const fakeKey = generateRandomKey(20); // Unique key for each fake entry
        //     const fakeValue = generateRandomKey(value.length);
            
        //     return {
        //         name,
        //         secret: fakeSecret,
        //         value: encrypt(fakeValue, fakeKey),
        //         cloudEntry: { 
        //             vaultName, 
        //             name, 
        //             secret: fakeSecret, 
        //             key: fakeKey, 
        //             isReal: 0 
        //         }
        //     };
        // });
        const fakeEntries = similarPasswords.map((genAIpassword) => {
            const fakeKey = generateRandomKey(20); // Keep generating random key
            const fakeValue = generateRandomKey(value.length); // Keep generating random value
            
            return {
                name, // Same name for all entries
                secret: genAIpassword, // Use password from Gen AI array
                value: encrypt(fakeValue, fakeKey),
                cloudEntry: {
                    vaultName,
                    name,
                    secret: genAIpassword,
                    key: fakeKey,
                    isReal: 0
                }
            };
        });
        // Shuffle entries for vault
        const allEntries = [
            realEntry, 
            ...fakeEntries.map(e => ({ 
                name: e.name, 
                secret: e.secret, 
                value: e.value 
            }))
        ];
        const shuffledEntries = allEntries.sort(() => Math.random() - 0.5);

        // Insert entries into vault
        vault.insert(shuffledEntries, (err) => {
            if (err) return logError(`Failed to add entries to vault: ${err.message}`);
            console.log(`Entry "${name}" and associated fake entries added to vault "${vaultName}".`);
        });

        // Insert real and fake entries into cloudDB
        const allCloudEntries = [
            realCloudEntry, 
            ...fakeEntries.map(e => e.cloudEntry)
        ];

        try {
            const response = await axios.post(`${API_BASE_URL}/clouddb/entry`, allCloudEntries);
            if (!response.data.success) {
                return logError('Failed to update cloudDB via API');
            }
            console.log(`Entry "${name}" and fake entries added to cloudDB.`);
        } catch (error) {
            logError(`Failed to update cloudDB: ${error.message}`);
        }
    });
}

async function getEntry(vaultName, masterKey, name, secret) {
    const vaultDb = new Db(VAULTS_PATH, {});
    const vault = vaultDb.collection(vaultName);

    try {
        const vaultInfo = await new Promise((resolve, reject) => {
            masterDb.collection('master').findOne({ vaultName, masterKey }, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        if (!vaultInfo) {
            return logError('Invalid master key or vault.');
        }

        const response = await axios.get(`${API_BASE_URL}/clouddb/entry`, {
            params: { vaultName, name, secret }
        });

        if (!response.data.success) {
            return logError('Entry not found or invalid.');
        }

        const key = response.data.key;

        const entry = await new Promise((resolve, reject) => {
            vault.findOne({ name, secret }, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        if (!entry) {
            return logError('Entry not found in vault.');
        }

        const decryptedValue = decrypt(entry.value, key);
        console.log(`Retrieved value: ${decryptedValue}`);

    } catch (error) {
        logError(`Error: ${error.message}`);
    }
}

async function seeAlerts() {
    try {
        const response = await axios.get(`${API_BASE_URL}/alerts`);
        if (!response.data.success) {
            return logError('Failed to retrieve alerts');
        }

        console.log('Alerts (sorted by time descending):');
        response.data.alerts.forEach((alert) => {
            console.log(alert);
        });
    } catch (error) {
        logError(`Failed to retrieve alerts: ${error.message}`);
    }
}

async function deleteVault(vaultName, masterKey) {
    const vaultDb = new Db(VAULTS_PATH, {});
    const vault = vaultDb.collection(vaultName);

    try {
        const vaultInfo = await new Promise((resolve, reject) => {
            masterDb.collection('master').findOne({ vaultName, masterKey }, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        if (!vaultInfo) {
            return logError('Invalid master key or vault.');
        }

        await new Promise((resolve, reject) => {
            vault.drop((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const response = await axios.delete(`${API_BASE_URL}/clouddb/entries`, {
            params: { vaultName }
        });

        if (!response.data.success) {
            logError('Failed to remove related entries in cloudDB');
        }

        await new Promise((resolve, reject) => {
            masterDb.collection('master').remove({ vaultName }, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log(`Vault "${vaultName}" and all associated data deleted.`);
    } catch (error) {
        logError(`Failed to delete vault: ${error.message}`);
    }
}

async function deleteEntry(vaultName, masterKey, name, secret) {
    const vaultDb = new Db(VAULTS_PATH, {});
    const vault = vaultDb.collection(vaultName);

    try {
        const vaultInfo = await new Promise((resolve, reject) => {
            masterDb.collection('master').findOne({ vaultName, masterKey }, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        if (!vaultInfo) {
            return logError('Invalid master key or vault.');
        }

        // Check if entry exists and is real via API
        const checkResponse = await axios.get(`${API_BASE_URL}/clouddb/entry`, {
            params: { vaultName, name, secret }
        });

        if (!checkResponse.data.success) {
            return logError('Entry not found or is a fake entry.');
        }

        await new Promise((resolve, reject) => {
            vault.remove({ name, secret }, { multi: true }, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const deleteResponse = await axios.delete(`${API_BASE_URL}/clouddb/entries`, {
            params: { vaultName, name }
        });

        if (!deleteResponse.data.success) {
            logError('Failed to remove entry from cloudDB');
        }

        console.log(`Entry "${name}" deleted from vault "${vaultName}".`);
    } catch (error) {
        logError(`Failed to delete entry: ${error.message}`);
    }
}

module.exports = {
    createVault,
    addEntry,
    getEntry,
    seeAlerts,
    deleteEntry,
    deleteVault
};