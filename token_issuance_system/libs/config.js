var nconf = require('nconf');
var log = require('./log')(module);
var nem = require("nem-sdk").default;

nconf.argv().env();

if (process.env.ENV_IN === 'docker') {
    nconf.file('docker', {
        file: process.cwd() + '/docker.config.json'
    });
}

nconf.file('defaults', {
    file: process.cwd() + '/config.json'
});

nconf.add('sphinks', { type: 'file', file: process.cwd() + '/sphinks-config.json' });

nconf.add('accounts', { type: 'file', file: process.cwd() + '/accounts-config.json' });

nconf.set('network:nemNetworkId', undefined);

if (nconf.get('network:network') === 'testnet') {
    log.info("Testnet - networkId set to: " + nem.model.network.data.testnet.id);
    nconf.set('network:nemNetworkId', nem.model.network.data.testnet.id)
}
if (nconf.get('network:network') === 'mainnet') {
    log.info("Mainnet - networkId set to: " + nem.model.network.data.mainnet.id);
    nconf.set('network:nemNetworkId', nem.model.network.data.mainnet.id)
}

module.exports = nconf;
