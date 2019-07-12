var log = require('../log')(module);
const bitcore = require("bitcore-lib");
const Insight = require('bitcore-insight').Insight;
const bitcoinSatoshis = 100000000;


var Client = require('node-rest-client').Client;
var client = new Client();

var config = require('../config');
var bitcoinRecord = require('./bitcoinRecord');
var sphinksRequest = require('./sphinksRequest');

var publicKey;
const btc_main_address = config.get('bitcoin:account');
const btc_85_percent_address = config.get('bitcoin:shareholder_85');
const btc_15_percent_address = config.get('bitcoin:shareholder_15');
const fee = config.get('bitcoin:fee');

var bitcoinNetwork = bitcore.Networks.livenet; 
var txReceived = "https://chain.so/api/v2/get_tx_received/BTC/";
var txInputs = "https://chain.so/api/v2/get_tx_inputs/BTC/";
var txAddressLatest50 = "https://chain.so/api/v2/address/BTC/";
let insight = new Insight('mainnet');
var txid;

if (config.get('network:network') === 'testnet') {
    bitcoinNetwork = bitcore.Networks.testnet;
    txReceived = "https://chain.so/api/v2/get_tx_received/BTCTEST/";
    txInputs = "https://chain.so/api/v2/get_tx_inputs/BTCTEST/";
    txAddressLatest50 = "https://chain.so/api/v2/address/BTCTEST/";
    insight = new Insight('testnet');
}

const state = {
    GET_RECIEVED: 0,
    GET_LATEST_50: 1,
    GET_INPUTS: 2,
    IDLE: 3,
};

const max_inputs = 7;
const max_idle = 3;

var current_state = state.GET_RECIEVED;
var current_inputs = 0;
var current_idle = 0;

var BreakException = {};

//function debugLog(str) { console.log(str); }
function debugLog(str) {}

function init() {
    var privateKey = new bitcore.PrivateKey(config.get('bitcoin:key'));
    publicKey = privateKey.toPublicKey();
    if (btc_main_address != publicKey.toAddress(bitcoinNetwork)) {
        log.error("The main bitcoin account address does not correspond to the key");
        process.exit(1);
    }

    if (!bitcore.Address.isValid(btc_85_percent_address)) {
        log.error("Tbtc_85_percent_address is not invalid");
        process.exit(1);
    }

    if (!bitcore.Address.isValid(btc_15_percent_address)) {
        log.error("Tbtc_15_percent_address is not invalid");
        process.exit(1);
    }

    txid = undefined;
}

function setIdleState() {
    current_inputs = 0;
    current_state = state.IDLE;
    debugLog("state.IDLE");
}

function setRecordAddress(record) {
    if (current_state != state.GET_INPUTS) {
        debugLog("Expected state.GET_INPUTS actual:" + current_state);
        return;
    }

    var txInputsURL = txInputs + record.txid;

    var request = client.get(txInputsURL, (data, response) => {

        try {
            if (data.data === undefined) {
                log.error("txInputs data undefined");
                setIdleState();
            } else if (data.data.inputs.length > 0) {
                record.set_address(data.data.inputs[0].address);

                current_inputs++;
                debugLog("current_inputs:" + current_inputs);
                if (current_inputs >= max_inputs) {
                    setIdleState();
                }
            } else {
                setIdleState();
            }
        } catch(e) {
            log.error("txInputs request FAILED: " + e.message);
        }

    });

    request.on('error', function (err) {
        log.error('getAddressByTxID Failed!!', err.request.options);
    });
}

function setLatestTxAddress() {
    bitcoinRecord.find({ address: { $eq: '' }})
        .sort({ _id : -1 })
        .exec()
        .then(requests => {
            debugLog("Records with no address: " + requests.length);
            if (requests.length > 0) {
                setRecordAddress(requests[0]);
            } else {
                setIdleState();
            }
        })
        .catch(err => {
            log.error('Internal error: %s', err.message);
        })
}

function getLatestTxID() {
    bitcoinRecord.find()
        .sort({ _id : -1 })
        .exec()
        .then(requests => {
            debugLog("Records in the DB: " + requests.length);
            if (requests.length > 0) {
                txid = requests[0].txid;
            } else {
                txid = '';
            }
            debugLog("The latest txid: " + txid);
        })
        .catch(err => {
            log.error('Internal error: %s', err.message);
        })
}

function getTxReceived() {

    if (current_state != state.GET_RECIEVED) {
        debugLog("Expected state.GET_RECIEVED actual:" + current_state);
        return;
    }

    var txReceivedURL = txReceived + btc_main_address;

    if (txid == undefined) {
        getLatestTxID();
        return;
    }

    if (txid) {
        txReceivedURL += "/" + txid;
    }

    debugLog("Querying: " + txReceivedURL);

    var request = client.get(txReceivedURL, function(data, response){

        try {
            if (data.data != undefined) {

                var txReceivedData = data.data.txs;

                debugLog("txReceived length: " + txReceivedData.length);

                txReceivedData.forEach(function(tx) {
                    if (tx.confirmations > 0) {

                        var btcRecord = new bitcoinRecord({
                            txid:  tx.txid,
                            value: tx.value,
                            time:  tx.time,
                            confirmations: tx.confirmations,
                        });

                        btcRecord.save();

                        txid = tx.txid;
                    }
                });

                debugLog("Latest txid: " + txid);

                if (txReceivedData.length < 100) {
                    current_state = state.GET_LATEST_50;
                    debugLog("state.GET_LATEST_50");
                }
            } else {
                log.error("txReceived data undefined");
            }
        } catch (e) {
            log.error("txReceived request FAILED: " + e.message);
        }

    });

    request.on('error', function (err) {
        log.error('getTxReceived Failed!!', err.request.options);
    });
}

function getAddressLatest50() {

    if (current_state != state.GET_LATEST_50) {
        debugLog("Expected state.GET_LATEST_50 actual:" + current_state);
        return;
    }

    var txAddressLatest50URL = txAddressLatest50 + btc_main_address;

    var request = client.get(txAddressLatest50URL, function(data, response){

        try {
            if (data.data != undefined) {

                var txReceivedData = data.data.txs;

                debugLog("txAddressLatest50 length: " + txReceivedData.length);

                txReceivedData.forEach(function(tx) {
                    //if (tx.confirmations > 0 && tx.incoming.inputs.length > 0) {
                    if (tx.confirmations > 0) {
                        bitcoinRecord.find({txid: {$eq: tx.txid}, state: {$lt: 100} })
                            .exec()
                            .then(requests => {
                                if (requests.length > 0) {
                                    if (requests[0].address) {
                                        requests[0].set_confirmations(tx.confirmations);
                                    } else {
                                        requests[0].set_address(tx.incoming.inputs[0].address);
                                    }
                                }
                            })
                            .catch(err => {
                                log.error('Internal error: %s', err.message);
                            })
                    }
                });

                current_state = state.GET_INPUTS;
                debugLog("state.GET_INPUTS");

            } else {
                log.error("txAddressLatest50URL data undefined");
            }

        } catch(e) {
            log.error("txAddressLatest50URL Failed: " + e.message);
        }
    });

    request.on('error', function (err) {
        log.error('getAddressLatest50 Failed!!', err.request.options);
    });

}

function processHttpGetRequests() {

    if (btc_main_address === undefined ) {
        return;
    }

    if (current_state === state.GET_RECIEVED) {
        getTxReceived();
        return;
    }
    if (current_state === state.GET_LATEST_50) {
        getAddressLatest50();
        return;
    }
    if (current_state === state.GET_INPUTS) {
        setLatestTxAddress();
        return;
    }
    if (current_state === state.IDLE) {
        current_idle++;
        debugLog("Idle:" + current_idle);
        if (current_idle >= max_idle) {
            current_idle = 0;
            current_state = state.GET_RECIEVED;
            debugLog("state.GET_RECIEVED");
        }
        return;
    }
}

function send_tx(btc_record, utxo, percent, to_address, change_address, completion_state) {

    if (!bitcore.Address.isValid(to_address)) {
        btc_record.set_error("The receiver is not a valid Legacy Bitcoin address:" + to_address);
        return;
    }

    if (!bitcore.Address.isValid(change_address)) {
        btc_record.set_error("The change address is not a valid Legacy Bitcoin address" + change_address);
        return;
    }

    if (utxo === undefined) {
        btc_record.set_error("sent_tx: undefined UTXO");
        return;
    }

    let satoshis = Math.trunc(btc_record.value * bitcoinSatoshis);

    if (satoshis != utxo.satoshis) {
        log.info("send_tx txid: " + btc_record.txid);
        log.info("Inconsistent value. Record has: " + satoshis + " Expected: " + utxo.satoshis);
    }

    try {
        let privateKey = new bitcore.PrivateKey(config.get('bitcoin:key'));

        let amount_to_send = (utxo.satoshis * percent) / 100;
        let fee_applied = fee;

        if (fee_applied * 10 > amount_to_send) {
            fee_applied = amount_to_send / 10 + 112;
        }

        amount_to_send -= fee_applied;

        if (amount_to_send <= 0) {
            btc_record.set_small_amount();
            return;
        }

        let tx = bitcore.Transaction();
        tx.from(utxo);
        tx.to(to_address, amount_to_send);
        tx.change(change_address);
        tx.fee(fee_applied);
        tx.sign(privateKey);
        tx.serialize();

        // Broadcast your transaction to the Bitcoin network
        insight.broadcast(tx.toString(), (error, txid) => {
            if (error) {
                btc_record.set_error("Cannot broadcast tx: " + error.message);
            } else {
                btc_record.set_state(completion_state)
            }
        })

    } catch (e) {
        btc_record.set_error("Cannot create tx: " + e.message + " To: " + to_address + " Change: " + change_address);
    }
}

function send_utxo(btc_record, percent, to_address, change_address, completion_state) {
    insight.getUtxos(btc_main_address, (err, utxos) => {
        if(err){
            btc_record.set_error("Failed getting utxos: " + err.message);
        } else {

            try {

                //log.debug("utxos.length: " + utxos.length);
                //log.debug("btc_record.txid: " + btc_record.txid);

                utxos.forEach(function(utxo) {
                    //log.debug("utxo.txId: " + utxo.txId);
                    if (btc_record.txid === utxo.txId) {
                        send_tx(btc_record, utxo, percent, to_address, change_address, completion_state);
                        throw BreakException;
                    }
                });

                log.info("UTXO not found. TxId: " + btc_record.txid);
                btc_record.set_no_utxo();

            } catch (e) {
                if (e === BreakException) {
                    // expected result: the utxo has been found
                } else {
                    btc_record.set_error("Failed searching utxos array: " + e.message);
                }
            }
        }
    });
}

function utxo_reverse(btc_record) {
    send_utxo(btc_record, 100, btc_record.address, btc_main_address, global.bitcoinRecord_RETURNED);
}

function enqueue_record(btc_record) {

    // try finding the corresponding request
    sphinksRequest.find({$and:[{ btc_address: { $eq: btc_record.address }, state: { $eq: sphinksRequest_AWAITING_FUNDS } }, {btc_address: {"$ne": null}}, {btc_address: {"$ne": ""}}]})
        .exec()
        .then(requests => {
            if (requests.length > 0) {
                if (requests.length === 1) {
                    btc_record.set_enqueued();
                    requests[0].set_confirming(btc_record.txid, btc_record.value);
                } else {
                    // TBD: unexpected case
                    // handle it correctly
                    // probably return the funds
                    // and put the requests into a collision state
                }

            } else if (btc_record.address) {
                btc_record.set_to_return();
                utxo_reverse(btc_record);
            }
        })
        .catch(err => {
            btc_record.set_error("Failed to enqueue a bitcoin record: " + err.message);
        })
}

function processIncomingTransactions() {

    bitcoinRecord.find({state: {$eq: global.bitcoinRecord_INITIAL}})
        .sort({ time : 1 })
        .exec()
        .then(requests => {
            debugLog("processIncomingTransactions found records: " + requests.length);
            requests.forEach(function(btc_record) {
                enqueue_record(btc_record);
            });
        })
        .catch(err => {
            log.error('Internal error: %s', err.message);
        })
}

function send_funds_to_shareholders(sphinks_request) {

    bitcoinRecord.find({txid: {$eq: sphinks_request.txid}})
        .exec()
        .then(records => {
            if (records.length === 1) {
                debugLog("send_funds_to_shareholders found record:");
                debugLog("state: " + records[0].state);
                debugLog("txid: " + records[0].txid);
                debugLog("value: " + records[0].value);

                send_utxo(records[0], 85, btc_85_percent_address, btc_15_percent_address, global.bitcoinRecord_COMPLETED);
                sphinks_request.set_funds_sent_to_shareholders();
            }
        })
        .catch(err => {
            sphinks_request.set_error("FAILED sending funds to shareholders: " + err.message);
        })
}

function processCompletedTransactions() {

    sphinksRequest.find({state: {$eq: global.sphinksRequest_COMPLETED}})
        .sort({ time : 1 })
        .exec()
        .then(requests => {
            debugLog("processCompletedTransactions found records: " + requests.length);
            requests.forEach(function(sphinks_request) {
                send_funds_to_shareholders(sphinks_request);
            });
        })
        .catch(err => {
            log.error('FAILED to process COMPLETED transactions: ' + err.message);
        })
}

function send_funds_back(sphinks_request) {

    bitcoinRecord.find({txid: {$eq: sphinks_request.txid}})
        .exec()
        .then(records => {
            debugLog("send_funds_back found records: " + records.length);
            if (records.length === 1) {
                utxo_reverse(records[0]);
                sphinks_request.set_funds_returned();
            }
        })
        .catch(err => {
            sphinks_request.set_error("FAILED sending funds back: " + err.message);
        })
}

function processErrorTransactions() {

    sphinksRequest.find({state: {$eq: global.sphinksRequest_ERROR}})
        .sort({ time : 1 })
        .exec()
        .then(requests => {
            debugLog("processErrorTransactions found sphinks requests: " + requests.length);
            requests.forEach(function(sphinks_request) {
                send_funds_back(sphinks_request);
            });
        })
        .catch(err => {
            log.error('FAILED to process ERROR sphinks requests: ' + err.message);
        })

    bitcoinRecord.find({state: {$eq: global.bitcoinRecord_ERROR}})
        .sort({ time : 1 })
        .exec()
        .then(requests => {
            debugLog("processErrorTransactions found bitcoin records: " + requests.length);
            requests.forEach(function(btc_record) {
                btc_record.debug_dump();
                //send_funds_back(sphinks_request);
                utxo_reverse(btc_record);
            });
        })
        .catch(err => {
            log.error('FAILED to process ERROR bitcoin records: ' + err.message);
        })

}

// Thread code which gets rates with pre-defined interval

const { Worker, isMainThread,  workerData } = require('worker_threads');

let interval = 4000;

function worker_function() {
    processHttpGetRequests();
    processIncomingTransactions();
    processCompletedTransactions();
    processErrorTransactions();
}

if(isMainThread) {
    init();
    setInterval((a) => worker_function(), interval, workerData);
}