// modules
var mongoose = require('mongoose');
var log = require('../log')(module);

var Schema = mongoose.Schema;

const state = {
    INITIAL: 0,
    ENQUEUED: 1,
    TO_RETURN: 2,

    // Finalized states
    COMPLETED: 100,
    RETURNED: 101,
    ERROR: 102,
    NO_UTXO: 103,
    SMALL_AMOUNT: 104
};

//function debugLog(str) { console.log(str); }
function debugLog(str) {}

global.bitcoinRecord_INITIAL = state.INITIAL;
global.bitcoinRecord_ENQUEUED = state.ENQUEUED;
global.bitcoinRecord_COMPLETED = state.COMPLETED;
global.bitcoinRecord_RETURNED = state.RETURNED;
global.bitcoinRecord_ERROR = state.ERROR;
global.bitcoinRecord_NO_UTXO = state.NO_UTXO;
global.bitcoinRecord_SMALL_AMOUNT = state.SMALL_AMOUNT;

var state_map = [
    {   id: state.INITIAL,      str: "INITIAL",},
    {   id: state.ENQUEUED,     str: "ENQUEUED",       },
    {   id: state.TO_RETURN,    str: "TO BE RETURNED", },
    {   id: state.COMPLETED,    str: "COMPLETED",      },
    {   id: state.RETURNED,     str: "RETURNED",       },
    {   id: state.ERROR,        str: "ERROR",          },
    {   id: state.NO_UTXO,      str: "NO UTXO FOUND",  },
    {   id: state.SMALL_AMOUNT, str: "AMOUNT IS TOO SMALL",  },
];

function state_to_string(state)
{
    var current = state_map.filter(state_map => state_map.id === state);
    if (current.length == 1) {
        return current[0].str;
    }
    return "";
}

var bitcoinRecord = new Schema({
    txid: { type: String, required: true },
    value: { type: Number, required: true },
    time: { type: Number, required: true },
    address: { type: String, default: '' },
    confirmations: {type: Number, default: 0 },
    sent_to_shareholders: {type: Number, default: 0},
    state: {type: Number, default: state.NO_UTXO},
    message: { type: String, default: '' },
}, {
    toObject: {
        transform: function (doc, ret) {
        }
    },
    toJSON: {
        transform: function (doc, ret) {
        }
    }
});

bitcoinRecord.methods.debug_dump = function() {
    debugLog("bitcon record: " + this._id);
    debugLog("\t" + "txid: " + this.txid);
    debugLog("\t" + "value: " + this.value);
    debugLog("\t" + "time: " + this.time);
    debugLog("\t" + "address: " + this.address);
    debugLog("\t" + "confirmations: " + this.confirmations);
    debugLog("\t" + "value in USD: " + (this.value * global.btc_rate));
};

bitcoinRecord.methods.set_address = function(address) {
    this.address = address;
    this.save(function(err) {
        if (err) {
            log.error("Error: " + err.message);
            return;
        }
    });
    log.info("bitcoinRecord.methods.set_address");
    log.info("txid: " + this.txid);
    log.info("value: " + this.value);
    log.info("time: " + this.time);
    log.info("address: " + this.address);
    log.info("confirmations: " + this.confirmations);
    log.info("value in USD: " + (this.value * global.btc_rate));
};

bitcoinRecord.methods.set_confirmations = function(confirmations) {
    if (confirmations === this.confirmations) {
        return;
    }
    this.confirmations = confirmations;

    this.save(function(err) {
        if (err) {
            log.error("Error: " + err.message);
            return;
        }
    });

    log.info("Txid: " + this.txid + "; Confirmations updated: " + confirmations + "; State: " + state_to_string(this.state));
};

bitcoinRecord.methods.is_confirmed = function() {
    return (this.confirmations > 0);
};

bitcoinRecord.methods.get_state_str = function()
{
    return state_to_string(this.state)
};

bitcoinRecord.methods.set_state = function(state, message) {
    this.state = state;
    this.message = message;

    this.save(function(err) {
        if (err) {
            log.error("Error: " + err.message);
            return;
        }
    });

    log.info("BTC Record txid: " + this.txid + " State changed to: " + this.get_state_str());
    if (message) {
        log.info("message: " + this.message);
    }
};

bitcoinRecord.methods.set_initial = function() {
    this.set_state(state.INITIAL, '');
};

bitcoinRecord.methods.is_initial = function() {
    return (this.state === state.INITIAL);
};

bitcoinRecord.methods.set_enqueued = function() {
    this.set_state(state.ENQUEUED, '');
};

bitcoinRecord.methods.is_enqueued = function() {
    return (this.state === state.ENQUEUED);
};

bitcoinRecord.methods.set_to_return = function() {
    this.set_state(state.TO_RETURN, '');
};

bitcoinRecord.methods.is_to_return = function() {
    return (this.state === state.TO_RETURN);
};

bitcoinRecord.methods.set_completed = function() {
    this.set_state(state.COMPLETED, '');
};

bitcoinRecord.methods.is_completed = function() {
    return (this.state === state.COMPLETED);
};

bitcoinRecord.methods.set_returned = function() {
    this.set_state(state.RETURNED, '');
};

bitcoinRecord.methods.is_returned = function() {
    return (this.state === state.RETURNED);
};

bitcoinRecord.methods.set_error = function(message) {
    this.set_state(state.ERROR, message);
};

bitcoinRecord.methods.is_error = function() {
    return (this.state === state.ERROR);
};

bitcoinRecord.methods.set_no_utxo = function(message) {
    this.set_state(state.NO_UTXO, message);
};

bitcoinRecord.methods.is_no_utxo = function() {
    return (this.state === state.NO_UTXO);
};

bitcoinRecord.methods.set_small_amount = function(message) {
    this.set_state(state.SMALL_AMOUNT, message);
};

bitcoinRecord.methods.is_small_amoutn = function() {
    return (this.state === state.SMALL_AMOUNT);
};

module.exports = mongoose.model('bitcoinRecord', bitcoinRecord);
