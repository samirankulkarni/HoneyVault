const { Db } = require('tingodb')();
const CryptoJS = require('crypto-js');
const path = require('path');

// Directory paths
const DATA_DIR = path.join(__dirname, 'data');
const MASTER_PATH = path.join(DATA_DIR, 'master');
const VAULTS_PATH = path.join(DATA_DIR, 'vaults');
const CLOUDDB_PATH = path.join(DATA_DIR, 'cloudDB');
const ALERTS_PATH = path.join(DATA_DIR, 'alerts');

// Initialize databases
const masterDb = new Db(MASTER_PATH, {});
const cloudDb = new Db(CLOUDDB_PATH, {});
const alertsDb = new Db(ALERTS_PATH, {});

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
    const cloudDbCollection = cloudDb.collection('cloudDB');

    masterDb.collection('master').findOne({ vaultName, masterKey }, (err, vaultInfo) => {
        if (err || !vaultInfo) return logError('Invalid master key or vault.');

        const encryptionKey = generateRandomKey(20);
        const encryptedValue = encrypt(value, encryptionKey);

        // Real entry
        const realEntry = { name, secret, value: encryptedValue };
        const realCloudEntry = { vaultName, name, secret, key: encryptionKey, isReal: 1 };

        // Fake entries
        const fakeEntries = Array(4).fill().map(() => {
            const fakeSecret = generateRandomKey(secret.length);
            const fakeValue = generateRandomKey(value.length);
            return {
                name,
                secret: fakeSecret,
                value: encrypt(fakeValue, encryptionKey),
                cloudEntry: { vaultName, name, secret: fakeSecret, key: encryptionKey, isReal: 0 }
            };
        });

        // Shuffle entries
        const allEntries = [realEntry, ...fakeEntries.map(e => ({ name: e.name, secret: e.secret, value: e.value }))];
        const shuffledEntries = allEntries.sort(() => Math.random() - 0.5);

        // Insert entries into the vault
        vault.insert(shuffledEntries, (err) => {
            if (err) return logError(`Failed to add entries to vault: ${err.message}`);
            console.log(`Entry "${name}" and associated fake entries added to vault "${vaultName}".`);
        });

        // Insert real and fake entries into cloudDB
        const allCloudEntries = [realCloudEntry, ...fakeEntries.map(e => e.cloudEntry)];
        cloudDbCollection.insert(allCloudEntries, (err) => {
            if (err) return logError(`Failed to update cloudDB: ${err.message}`);
            console.log(`Entry "${name}" and fake entries added to cloudDB.`);
        });
    });
}

// Additional functions (getEntry, seeAlerts, deleteVault, deleteEntry) would follow a similar structure...

function getEntry(vaultName, masterKey, name, secret) {
    const vaultDb = new Db(VAULTS_PATH, {});
    const vault = vaultDb.collection(vaultName);
    const cloudDbCollection = cloudDb.collection('cloudDB');
    const alertsCollection = alertsDb.collection('alerts');

    masterDb.collection('master').findOne({ vaultName, masterKey }, (err, vaultInfo) => {
        if (err || !vaultInfo) {
            return logError('Invalid master key or vault.');
        }

        cloudDbCollection.findOne({ vaultName, name, secret }, (err, cloudEntry) => {
            if (err || !cloudEntry) {
                return logError('Entry not found in cloudDB.');
            }

            const { key, isReal } = cloudEntry;

            if (isReal === 0) {
                const alert = { vaultName, name, secret, timestamp: new Date().toISOString() };
                alertsCollection.insert(alert, (err) => {
                    if (err) logError(`Failed to log alert: ${err.message}`);
                });
                console.log('Fake entry detected. Alert logged.');
            } else {
                vault.findOne({ name, secret }, (err, entry) => {
                    if (err || !entry) {
                        return logError('Entry not found in vault.');
                    }
                    const decryptedValue = decrypt(entry.value, key);
                    console.log(`Retrieved value: ${decryptedValue}`);
                });
            }
        });
    });
}


function seeAlerts() {
    const alertsCollection = alertsDb.collection('alerts');

    alertsCollection.find().sort({ timestamp: -1 }).toArray((err, alerts) => {
        if (err) {
            return logError(`Failed to retrieve alerts: ${err.message}`);
        }

        console.log('Alerts (sorted by time descending):');
        alerts.forEach((alert) => {
            console.log(alert);
        });
    });
}

function deleteVault(vaultName, masterKey) {
    const vaultDb = new Db(VAULTS_PATH, {});
    const vault = vaultDb.collection(vaultName);
    const cloudDbCollection = cloudDb.collection('cloudDB');

    masterDb.collection('master').findOne({ vaultName, masterKey }, (err, vaultInfo) => {
        if (err || !vaultInfo) {
            return logError('Invalid master key or vault.');
        }

        vault.drop((err) => {
            if (err) return logError(`Failed to delete vault "${vaultName}": ${err.message}`);

            cloudDbCollection.remove({ vaultName }, { multi: true }, (err) => {
                if (err) logError(`Failed to remove related entries in cloudDB: ${err.message}`);
            });

            masterDb.collection('master').remove({ vaultName }, (err) => {
                if (err) logError(`Failed to remove vault from master: ${err.message}`);
            });

            console.log(`Vault "${vaultName}" and all associated data deleted.`);
        });
    });
}

function deleteEntry(vaultName, masterKey, name, secret) {
    const vaultDb = new Db(VAULTS_PATH, {});
    const vault = vaultDb.collection(vaultName);
    const cloudDbCollection = cloudDb.collection('cloudDB');

    masterDb.collection('master').findOne({ vaultName, masterKey }, (err, vaultInfo) => {
        if (err || !vaultInfo) {
            return logError('Invalid master key or vault.');
        }

        cloudDbCollection.findOne({ vaultName, name, secret }, (err, cloudEntry) => {
            if (err || !cloudEntry) {
                return logError('Entry not found in cloudDB.');
            }

            if (cloudEntry.isReal === 0) {
                logError('Cannot delete fake entry.');
                return;
            }

            vault.remove({ name, secret }, { multi: true }, (err) => {
                if (err) return logError(`Failed to remove entry from vault: ${err.message}`);

                cloudDbCollection.remove({ vaultName, name }, { multi: true }, (err) => {
                    if (err) logError(`Failed to remove entry from cloudDB: ${err.message}`);
                });

                console.log(`Entry "${name}" deleted from vault "${vaultName}".`);
            });
        });
    });
}


module.exports = {
    createVault,
    addEntry,
    getEntry,
    seeAlerts,
    deleteEntry,
    deleteVault
};
