const { createVault, addEntry, getEntry, seeAlerts, deleteEntry, deleteVault } = require('./index');

// createVault('v1', 'mk1');
// createVault('v2','mk2');
// addEntry('v1','mk1','sam','max','value1')
// addEntry('v2','mk2','shanks','luffy','value2')

getEntry('v1','mk1','sam','max')
getEntry('v1','mk1','sam','max001')

// deleteVault('v1','mk1')

seeAlerts();
