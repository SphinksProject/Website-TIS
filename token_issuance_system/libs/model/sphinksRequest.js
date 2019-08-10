// modules
var mongoose = require('mongoose');
var config = require('../config');
var log = require('../log')(module);
var nem = require("nem-sdk").default;

// module constants
const request_timeout = config.get('request:timeout') * 1000;
const confirmation_hold = config.get('request:confirmation_hold') * 1000;

// transaction related
const nem_node_url = config.get('network:nem_node_url');
const networkId = config.get('network:nemNetworkId');
const max_tokens_per_interval = config.get('request:max_tokens_per_interval');
const oneXEM = 1000000.0 // 1 xem == 1000000.0 [small xem units]
const oneSphinksToken = 1000000;
const mosaic_namespace = config.get('mosaic:namespace');
const mosaic_name = config.get('mosaic:mosaic_name');
const mosaic_exchange_rate = config.get('mosaic:exchange_rate');

var endpoint = nem.model.objects.create("endpoint")(nem_node_url, nem.model.nodes.defaultPort);
var common = nem.model.objects.create("common")('', config.get('nem:key'));
var mosaicDefinitions = nem.model.objects.get("mosaicDefinitionMetaDataPair");

const state = {
    // in progress states
    CREATED: 0,
    AWAITING_FUNDS: 1,
    QUEUED: 2,
    CONFIRMING: 3,

    // finalized states
    COMPLETED: 100,
    ERROR: 101,
    TIMED_OUT: 102,
    FUNDS_SENT_TO_SHAREHOLDERS: 103,
    FUNDS_RETURNED: 104
};

global.sphinksRequest_AWAITING_FUNDS = state.AWAITING_FUNDS;
global.sphinksRequest_CONFIRMING = state.CONFIRMING;
global.sphinksRequest_QUEUED = state.QUEUED;
global.sphinksRequest_COMPLETED = state.COMPLETED;
global.sphinksRequest_ERROR = state.ERROR;

var state_map = [
    {   id: state.CREATED,         str: "CREATED",         },
    {   id: state.AWAITING_FUNDS,  str: "AWAITING FUNDS",  },
    {   id: state.CONFIRMING,      str: "CONFIRMING",      },
    {   id: state.QUEUED,          str: "QUEUED",          },
    {   id: state.COMPLETED,       str: "TOKENS ISSUED",   },
    {   id: state.FUNDS_SENT_TO_SHAREHOLDERS,       str: "COMPLETED",       },
    {   id: state.ERROR,           str: "ERROR",           },
    {   id: state.FUNDS_RETURNED,  str: "ERROR",           },
    {   id: state.TIMED_OUT,       str: "TIMED OUT",       },
];

function state_to_string(state)
{
    var current = state_map.filter(state_map => state_map.id === state);
    if (current.length == 1) {
        return current[0].str;
    }
    return "";
}

var month_map = [
    {   id: 1,  str: "Jan.",  },
    {   id: 2,  str: "Feb.",  },
    {   id: 3,  str: "Mar.",  },
    {   id: 4,  str: "Apr.",  },
    {   id: 5,  str: "May",   },
    {   id: 6,  str: "Jun.",  },
    {   id: 7,  str: "Jul.",  },
    {   id: 8,  str: "Aug.",  },
    {   id: 9,  str: "Sept.",  },
    {   id: 10,  str: "Oct.",  },
    {   id: 11,  str: "Nov.",  },
    {   id: 12,  str: "Dec.",  },
];

//function debugLog(str) {console.log(str);}
function debugLog(str) {}

function month_to_string(month)
{
    var current = month_map.filter(month_map => month_map.id === month);
    if (current.length == 1) {
        return current[0].str;
    }
    return "";
}

function get_time_str(time_millis)
{
    var d = new Date(time_millis);
    var retval = d.getUTCDate() + " " + month_to_string(d.getUTCMonth() + 1) + " " + d.getUTCFullYear() + " ";
    retval += d.getUTCHours() + ":";
    if (d.getUTCMinutes() < 10) {
        retval += "0";
    }
    retval += d.getUTCMinutes() + ":";
    if (d.getUTCSeconds() < 10) {
        retval += "0";
    }
    retval += d.getUTCSeconds();
    retval += " GMT";
    return retval;
}

var Schema = mongoose.Schema;

var sphinksRequest = new Schema({
    nem_address: { type: String, required: true },
    btc_address: { type: String, required: false },
    eth_address: { type: String, required: false },
    creation_timestamp: { type: Number, default: Date.now },
    funds_received_timestamp: { type: Number, default: 0 },
    funds: {type: Number, default: 0},
    tokens: {type: Number, default: 0},
    rate: {type: Number, default: 0},
    retry_attempts: {type: Number, default: 0},
    state: {type: Number, default: state.CREATED},
    message: { type: String, default: '' },
    txid: { type: String, default: '' },
}, {
    toObject: {
        transform: function (doc, ret) {
        }
    },
    toJSON: {
        transform: function (doc, ret) {
            //ret.created_at = get_time_str(ret.creation_timestamp);
            ret.status = state_to_string(ret.state);
            ret.active_until = "";
            if (ret.state == state.AWAITING_FUNDS) {
                ret.active_until = get_time_str(ret.creation_timestamp + request_timeout);
            }
            delete ret.__v;
            delete ret.state;
            delete ret.funds_received_timestamp;
        }
    }
});

sphinksRequest.methods.debug_dump = function() {
    debugLog("sphinksRequest: " + this._id);
    debugLog("\t" + "state: " + state_to_string(this.state));
    debugLog("\t" + "txid: " + this.txid);
};

sphinksRequest.methods.delete = function()
{
    this.remove({ _id: this.id }, function(err) {
        if (err) {
            log.error(err)
        }
    });
};

sphinksRequest.methods.get_state_str = function()
{
    return state_to_string(this.state)
};

sphinksRequest.methods.set_state = function(new_state, message) {
    this.state = new_state;


    this.save(function(err) {
        if (err) {
            log.error(err.message);
            return undefined;
        }
    });

    log.info("ID:" + this.id + " " + this.get_state_str());
    if (message) {
        this.message = message;
        log.info("Message: " + message);
    }

    return this.id;
};

// AWAITING_FUNDS
sphinksRequest.methods.is_awaiting_funds = function() {
    return (this.state == state.AWAITING_FUNDS);
};

sphinksRequest.methods.set_awaiting_funds = function() {
    this.creation_timestamp = Date.now();

    this.save(function(err) {
        if (err) {
            log.error(err.message);
            return undefined;
        }
    });

    var message = "";

    if (this.btc_address) {
        message = "From " + this.btc_address;
    }

    if (this.eth_address) {
        message = "From " + this.eth_address;
    }

    return this.set_state(state.AWAITING_FUNDS, message);
};

// QUEUED
sphinksRequest.methods.is_queued = function() {
    return (this.state == state.QUEUED);
};

sphinksRequest.methods.set_queued = function(message) {
    this.rate = global.btc_rate * mosaic_exchange_rate;

    this.save(function(err) {
        if (err) {
            log.error(err.message);
            return undefined;
        }
    });

    return this.set_state(state.QUEUED, message);
};

// CONFIRMING
sphinksRequest.methods.is_confirming = function() {
    return (this.state == state.CONFIRMING);
};

sphinksRequest.methods.set_confirming = function(txid, funds) {
    this.funds_received_timestamp = Date.now();
    this.txid = txid;
    this.funds = funds;

    this.save(function(err) {
        if (err) {
            log.error(err.message);
            return undefined;
        }
    });

    return this.set_state(state.CONFIRMING, "");
};

// COMPLETED
sphinksRequest.methods.is_completed = function() {
    return (this.state == state.COMPLETED);
};

sphinksRequest.methods.set_completed = function(message) {
    return this.set_state(state.COMPLETED, message);
};

// FUNDS_SENT_TO_SHAREHOLDERS
sphinksRequest.methods.is_funds_sent_to_shareholders = function() {
    return (this.state == state.FUNDS_SENT_TO_SHAREHOLDERS);
};

sphinksRequest.methods.set_funds_sent_to_shareholders = function(message) {
    return this.set_state(state.FUNDS_SENT_TO_SHAREHOLDERS, message);
};

// ERROR
sphinksRequest.methods.is_error = function() {
    return (this.state == state.ERROR);
};

sphinksRequest.methods.set_error = function(message) {
    // TBD: set corresponding transaction to error
    return this.set_state(state.ERROR, message);
};

// FUNDS_RETURNED
sphinksRequest.methods.is_funds_returned = function() {
    return (this.state == state.FUNDS_RETURNED);
};

sphinksRequest.methods.set_funds_returned = function(message) {
    // TBD: set corresponding transaction to error
    return this.set_state(state.FUNDS_RETURNED, message);
};

// TIMED_OUT
sphinksRequest.methods.is_timed_out = function() {
    return (this.state == state.TIMED_OUT);
};

sphinksRequest.methods.verify_timed_out = function() {
    if (this.is_awaiting_funds() &&
        (Date.now() > this.creation_timestamp + request_timeout)) {
        this.set_timed_out();
    }
    return this.is_timed_out();
};

sphinksRequest.methods.verify_confirmation_time = function() {
    if (this.is_confirming() &&
        (Date.now() > this.funds_received_timestamp + confirmation_hold)) {
        this.set_queued();
    }
    return this.is_queued();
};

sphinksRequest.methods.set_timed_out = function(message) {
    return this.set_state(state.TIMED_OUT, message);
};

// Set funds
/*
sphinksRequest.methods.set_funds = function(funds) {
    this.funds = funds;

    log.info(get_time_str(Date.now()) + " " + this.id + "; Funds set:" + funds);

    this.save(function(err) {
        if (err) {
            log.error(err.message);
            return undefined;
        }
    });

    return this.id;
};
*/

// Set message
sphinksRequest.methods.set_message = function(message) {
    this.message = message;

    this.save(function(err) {
        if (err) {
            log.error(err.message);
            return undefined;
        }
    });

    return this.id;
};

sphinksRequest.methods.set_timestamp = function() {
    this.timestamp = Date.now;

    this.save(function(err) {
        if (err) {
            log.error(err.message);
            return undefined;
        }
    });

    return this.id;
};

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
};

function calculate_fee(preparedTransaction) {

    // preparedTransaction format
    // https://forum.nem.io/t/sending-mosaics-express-nem-sdk-change-not-reflected-in-nano-wallet/18662
    //
    // {   type: 257,
    //     version: -1744830462,
    //     signer: 'f1fcecfebb32e4230e401ca9d10c3f804d92079847272acaa0b04b017d060796',
    //     timeStamp: 106053913,
    //     deadline: 106057513,
    //     recipient: 'TBKRXIJC4YNIOWQLZFVQNP2FFL5GN4Q2OTHDG6B7',
    //     amount: 0,
    //     fee: NaN,
    //     message: {
    //         type: 1,
    //         payload: '6665656c20746865206372797374616c20636c656172207761746572'
    //     },
    //     mosaics: [{ mosaicId: [Object], quantity: 5 }]
    // }

    //debugLog("preparedTransaction.fee:\n" + preparedTransaction.fee);
    //debugLog("message.length:\n" + message.length);
    //debugLog("preparedTransaction.message.payload.length:\n" + preparedTransaction.message.payload.length);

    // Calculation algorithm: https://nemproject.github.io/#transaction-fees

    // totalMosaicQuantity = 9,000,000 * 1,000 = 9,000,000,000
    // supplyRelatedAdjustment = floor(0.8 * ln(9,000,000,000,000,000 / 9,000,000,000)) = floor(11.052) = 11
    // transferring 150 such mosaics (i.e. a quantity of 150,000 smallest units) has
    // xemEquivalent = (8,999,999,999 * 150,000) / (9,000,000 * 10^3) = 149,999
    // xemFee = 14 XEM
    // So the transaction will have the following unweighted fee:
    //     unweightedFee = 14 XEM - 11 XEM = 3 XEM
    // Weighted with the current fee unit of 0.05:
    // fee = 3 XEM * 0.05 = 0.15 XEM

    // debugLog("mosaics quantity:\n" + preparedTransaction.mosaics[0].quantity);
    //const totalMosaicQuantity = preparedTransaction.mosaics[0].quantity;
    //const maxMosaicQuantity = 9000000000000000;
    //const supplyRelatedAdjustment = Math.floor(0.8 * Math.log(maxMosaicQuantity/totalMosaicQuantity));
    // TBD

    var tokenTransactionFee = 0.05 * oneXEM;
    var messageTransactionFee = (0.05 * Math.ceil(preparedTransaction.message.payload.length / 64)) * oneXEM
    var totalTransactionFeeXEM = tokenTransactionFee + messageTransactionFee;

    preparedTransaction.fee = Math.max(0.05 * oneXEM, totalTransactionFeeXEM);
}

sphinksRequest.methods.do_transaction = function() {

    // the code below is based on the following:
    // https://github.com/QuantumMechanics/NEM-sdk/blob/master/examples/nodejs/mosaicTransfer.js
    //
    // https://github.com/filipmartinsson/nem-tutorial/blob/master/mosiacTransaction.js
    // https://www.youtube.com/watch?v=yrNUCKpBWx0
    //
    // for FAILURE_TIMESTAMP_TOO_FAR_IN_FUTURE
    // https://pastebin.com/HqcDeaEC
    //
    // Get the token transferred
    // https://forum.nem.io/t/sending-mosaics-express-nem-sdk-change-not-reflected-in-nano-wallet/18662

    var message = "ID:" + this.id;

    var transferTransaction = nem.model.objects.create("transferTransaction")(this.nem_address, 1, message);

    //var mosaicAttachment = nem.model.objects.create("mosaicAttachment")("sphinks", "token", this.tokens);
    var mosaicAttachment = nem.model.objects.create("mosaicAttachment")(mosaic_namespace, mosaic_name, this.tokens);

    transferTransaction.mosaics.push(mosaicAttachment);

    nem.com.requests.namespace.mosaicDefinitions(endpoint, mosaicAttachment.mosaicId.namespaceId).then((res) => {
        var definition = nem.utils.helpers.searchMosaicDefinitionArray(res.data, ["token"]);
        var fullName = nem.utils.format.mosaicIdToName(mosaicAttachment.mosaicId);
        mosaicDefinitions[fullName] = {};
        mosaicDefinitions[fullName].mosaicDefinition = definition[fullName];

        var preparedTransaction = nem.model.transactions.prepare("mosaicTransferTransaction")(common, transferTransaction, mosaicDefinitions, networkId);

        // due to a bug in nem-sdk you must set .fee manualy else sdk will through Error: FAILURE_INSUFFICIENT_FEE
        calculate_fee(preparedTransaction);

        nem.com.requests.chain.time(endpoint).then((timeStamp) => {
            const ts = Math.floor(timeStamp.receiveTimeStamp / 1000);
            preparedTransaction.timeStamp = ts;
            const due = 60;
            preparedTransaction.deadline = ts + due * 60;

            nem.model.transactions.send(common, preparedTransaction, endpoint).then((res) => {
                if (res.code === 1 && res.type === 1 && res.message === "SUCCESS") {
                    this.set_completed();
                } else {
                    this.set_error(res.message);
                }
            });
        });

    }).catch((err) => {
        this.set_error(err.message);
    });
};

sphinksRequest.methods.exchange = function() {

    if (this.funds <= 0) {
        return false;
    }

    if (this.funds * this.rate <= max_tokens_per_interval) {
        // finalize it
        this.tokens += (this.funds * this.rate) * oneSphinksToken;
        this.funds = 0;
    } else {
        // exchange a portion of the funds
        this.tokens += max_tokens_per_interval * oneSphinksToken;
        this.funds -= max_tokens_per_interval / this.rate;
    }

    log.info("Exchange cycle for ID:" + this.id + "; Rate:" + this.rate + "; Funds:" + this.funds + "; Tokens:" + this.tokens);

    this.save(function(err) {
        if (err) {
            log.error(err.message);
            return undefined;
        }
    });

    if (this.funds === 0 && this.tokens > 0) {
        this.do_transaction();
    }

    return true;
};

sphinksRequest.methods.is_btc = function(){
    return (this.btc_address && !this.eth_address);
};

sphinksRequest.methods.is_eth = function(){
    return (!this.btc_address && this.eth_address);
};

/*
sphinksRequest.methods.set_txid = function(txid) {
    this.txid = txid;

    this.save(function(err) {
        if (err) {
            log.error(err.message);
            return undefined;
        }
    });
};
*/

module.exports = mongoose.model('sphinksRequest', sphinksRequest);