const express = require('express');
const { Db } = require('tingodb')();
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 45107;

// Database paths
const DATA_DIR = path.join(__dirname, 'data');
const CLOUDDB_PATH = path.join(DATA_DIR, 'cloudDB');
const ALERTS_PATH = path.join(DATA_DIR, 'alertDB');

// Initialize databases
const cloudDb = new Db(CLOUDDB_PATH, {});
const alertsDb = new Db(ALERTS_PATH, {});

// Logging function
function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}\n#####\n`;
    fs.appendFileSync('logs.txt', logMessage);
}

// Find one entry in cloudDB
app.get('/api/clouddb/entry', (req, res) => {
    const { vaultName, name, secret } = req.query;
    
    logToFile(`REQUEST: GET /api/clouddb/entry - vaultName: ${vaultName}, name: ${name}, secret: ${secret}`);
    
    cloudDb.collection('cloudDB').findOne({ vaultName, name, secret }, (err, entry) => {
        if (err) {
            logToFile(`ERROR: ${err.message}`);
            return res.status(500).json({ success: false, error: err.message });
        }
        
        if (!entry) {
            logToFile(`RESPONSE: Entry not found`);
            return res.status(404).json({ success: false, message: 'Entry not found' });
        }

        if (entry.isReal === 0) {
            // Log alert for fake entry access
            const alert = {
                vaultName,
                name,
                secret,
                timestamp: new Date().toISOString()
            };
            
            alertsDb.collection('alerts').insert(alert, (err) => {
                if (err) {
                    logToFile(`ERROR: Failed to log alert - ${err.message}`);
                    // Still return the key even if alert logging fails
                }
                logToFile(`RESPONSE: Fake entry detected, alert logged`);
                return res.json({ success: true, key: entry.key });
            });
        } else {
            logToFile(`RESPONSE: Entry found, returning encryption key`);
            res.json({ success: true, key: entry.key });
        }
    });
});

// Add entries to cloudDB
app.post('/api/clouddb/entry', (req, res) => {
    const entries = req.body;
    
    logToFile(`REQUEST: POST /api/clouddb/entry - Adding ${entries.length} entries`);
    
    cloudDb.collection('cloudDB').insert(entries, (err) => {
        if (err) {
            logToFile(`ERROR: ${err.message}`);
            return res.status(500).json({ success: false, error: err.message });
        }
        
        logToFile(`RESPONSE: Entries added successfully`);
        res.json({ success: true });
    });
});

// Delete entries from cloudDB
app.delete('/api/clouddb/entries', (req, res) => {
    const { vaultName, name } = req.query;
    const query = name ? { vaultName, name } : { vaultName };
    
    logToFile(`REQUEST: DELETE /api/clouddb/entries - vaultName: ${vaultName}${name ? `, name: ${name}` : ''}`);
    
    cloudDb.collection('cloudDB').remove(query, { multi: true }, (err) => {
        if (err) {
            logToFile(`ERROR: ${err.message}`);
            return res.status(500).json({ success: false, error: err.message });
        }
        
        logToFile(`RESPONSE: Entries deleted successfully`);
        res.json({ success: true });
    });
});

// Get all alerts
app.get('/api/alerts', (req, res) => {
    logToFile('REQUEST: GET /api/alerts');
    
    alertsDb.collection('alerts').find().sort({ timestamp: -1 }).toArray((err, alerts) => {
        if (err) {
            logToFile(`ERROR: ${err.message}`);
            return res.status(500).json({ success: false, error: err.message });
        }
        
        logToFile(`RESPONSE: Retrieved ${alerts.length} alerts`);
        res.json({ success: true, alerts });
    });
});


app.listen(PORT, () => {
    console.log(`Cloud server running on port ${PORT}`);
    logToFile(`Server started on port ${PORT}`);
});