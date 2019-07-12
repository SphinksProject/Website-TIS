// Required modules
var express = require('express');

var config = require('../config');
var log = require('../log')(module);
var sphinksRequest = require('../model/sphinksRequest');
var nem = require("nem-sdk").default;
var bitcore = require("bitcore-lib");
const iplocation = require("iplocation").default;

// Module variables
var router = express.Router();
var latestAcceptanceTimestamp = 0;
var current_queue_size = 0;
var current_all_requests = 0;

// Constants
const acceptance_interval = config.get('request:acceptance_interval');
const account = config.get('nem:account');
const networkId = config.get('network:nemNetworkId');
const blacklisted_countries = config.get('request:rejected_countries');

//function debugLog(str) { console.log(str); }
function debugLog(str) {}


function is_country_blacklisted(country_code) {
    return (blacklisted_countries.indexOf(country_code) > -1);;
}

function verifyRequestFormat(req)
{
    if (req.body.nem_address == undefined) {
        log.error("No NEM address in the request");
        return false;
    }

    if (req.body.btc_address == undefined) {
        log.error("No Bitcoin address in the request");
        return false;
    }

    if (req.body.eth_address == undefined) {
        log.error("No Ehtereum address in the request");
        return false;
    }

    return true;
}

function verifyAddressValidity(req) {

    if (!nem.model.address.isValid(req.body.nem_address)) {
        return "NEM address is invalid";
    }

    if (!nem.model.address.isFromNetwork(req.body.nem_address, networkId)) {
        return "NEM address is not from the expected network";
    }

    if (!req.body.btc_address && !req.body.eth_address) {
        return "Request must have BTC or ETH address";
    }

    if (req.body.btc_address && req.body.eth_address) {
        return "Request cannot have both BTC and ETH address";
    }

    if (req.body.btc_address && !bitcore.Address.isValid(req.body.btc_address)) {
        return "The address provided is not a valid Legacy Bitcoin address";
    }

    return undefined;
}

router.post("/", (req, res) => {
    let message = '';

    if (req.body == undefined) {
        message = 'Undefined request';
        log.error(message);
        res.json({
            msg: message,
            status: 'ERROR',
            id: 0
        });
        return;
    }

    log.info("Request received from: " + req.ip);
    log.info(req.body);

    if (Date.now() - latestAcceptanceTimestamp < acceptance_interval) {
        message = 'DOS attack protection';
        log.error('REJECTED: ' + message);
        res.json({
            msg: message,
            status: 'REJECTED',
            id: 'none'
        });
        return;
    }

    if (!verifyRequestFormat(req)) {
        message = 'Badly formatted request';
        log.error('REJECTED: ' + message);
        res.json({
            msg: message,
            status: 'REJECTED',
            id: 'none'
        });
        return;
    }

    message = verifyAddressValidity(req);
    if (message) {
        log.error("REJECTED: " + message);
        res.json({
            msg: message,
            status: 'REJECTED',
            id: 'none'
        });
        return;
    }



    // Verify the sender is not in the queue
    sphinksRequest.find({ btc_address: { $eq: req.body.btc_address }, eth_address : { $eq: req.body.eth_address }, state : { $lt: 100} })
        .exec()                   // execute the query
        .then(requests => {
            if (requests.length > 0) {
                message = 'Active request from the same address';
                log.error("REJECTED: " + message);
                res.json({
                    msg: message,
                    status: 'REJECTED',
                    id: 0
                });
                return;
            }

            //let ip = req.ip;
            let ip = req.body.ip_address;
            if (ip.startsWith('::ffff:')) {
                ip = ip.split('::ffff:').pop();
            }
            iplocation(ip, [], (error, res_ip) => {
                if (is_country_blacklisted(res_ip.country)) {
                    message = "Request from country " + res_ip.country + " IP:" + ip;
                    log.error("REJECTED: " + message);
                    res.json({
                        msg: message,
                        status: 'REJECTED',
                        id: 0
                    });
                    return;
                }

                latestAcceptanceTimestamp = Date.now();
                var id = accept_request(req);

                if (id) {
                    message = 'Request accepted';
                    log.info("SUCCESS: " + message);
                    res.json({
                        msg: message,
                        status: 'SUCCESS',
                        id: id
                    });
                    return;
                }

                message = 'The request has not been queued';
                log.error("ERROR" + message);
                res.json({
                    msg: message,
                    status: 'ERROR',
                    id: 0
                });
            });

        })
        .catch(err => {
            log.error('Internal error: %s', err.message);
            res.json({
                msg: 'ERROR: ' + err.message,
                status: 'ERROR',
                id: 0
            });
        });
});

router.get("/", (req, res) => {
    res.json({
        msg: 'Not implemented'
    });
});

function get_queue_size() {
    // find all in progress requests
    // TBD: all enqueued requests
    sphinksRequest.find({ state: { $eq: global.sphinksRequest_QUEUED } })
        .exec()               // execute the query
        .then(requests => {
            current_queue_size = requests.length;
        })
        .catch(err => {
            log.error('Internal error: %s', err.message);
        })
};

router.get("/queue-size", (req, res) => {
    res.json({
        msg: "",
        status: 'SUCCESS',
        size: current_queue_size,
        collection_size: current_all_requests
    });
});

router.put("/", (req, res) => {
    res.json({
        msg: 'Not implemented'
    });
});

function list_requests(res, address, timestamp) {
    // find all requests sent from the address
    sphinksRequest.find({ nem_address: { $eq: address }, creation_timestamp : { $gt : timestamp} })
        .sort({ creation_timestamp : -1})
        .exec()                   // execute the query
        .then(requests => {
            var transformedRequest = requests.map(function(request) {
                return request.toJSON();
            });

            res.setHeader('Content-Type', 'application/json');
            res.send(transformedRequest);
        })
        .catch(err => {
            log.error('Internal error: %s', err.message);
            res.json({
                error: err.message
            });
        })
}

router.get('/request/:address', (req, res, next) => {
    list_requests(res, req.params.address, 0)
});

router.get('/request/:address/:timestamp', (req, res, next) => {
    list_requests(res, req.params.address, req.params.timestamp)
});

router.get('/addresses', (req, res, next) => {
    let ip = req.ip;
    if (ip.startsWith('::ffff:')) {
        ip = ip.split('::ffff:').pop();
    }
    iplocation(ip, [], (error, res_ip) => {
        res.json({
            nem: config.get('nem:account'),
            btc: config.get('bitcoin:account'),
            eth: config.get('ethereum:account'),
            ip: ip,
            country: res_ip.country
        });
    });
});

module.exports = router;

// Thread code to process sphinks requests

const { Worker, isMainThread,  workerData } = require('worker_threads');

function accept_request(request){
    var sph_request = new sphinksRequest({
        nem_address: request.body.nem_address,
        btc_address: request.body.btc_address,
        eth_address: request.body.eth_address,
    });

    log.info("New request created");
    log.info("nem_address: " + request.body.nem_address);
    log.info("btc_address: " + request.body.btc_address);
    log.info("eth_address: " + request.body.eth_address);

    return sph_request.set_awaiting_funds();
}

function handle_awaiting_funds() {

    sphinksRequest.find({ state: { $eq: global.sphinksRequest_AWAITING_FUNDS } })     // find all in progress requests
        .exec()                   // execute the query
        .then(requests => {
            debugLog("handle_awaiting_funds: " + requests.length);
            requests.forEach(function(request) {
                if (request.verify_timed_out()) {
                    // TBD: handle timed out requests if needed
                }
            });
        })
        .catch(err => {
            log.error('Internal error: %s', err.message);
        })
}

function handle_confirming() {

    sphinksRequest.find({ state: { $eq: global.sphinksRequest_CONFIRMING } })
        .exec()                   // execute the query
        .then(requests => {
            requests.forEach(function(request) {
                if (request.verify_confirmation_time()) {
                    // TBD: handle confirming requests if needed
                }
            });
        })
        .catch(err => {
            log.error('Internal error: %s', err.message);
        })
}


function handle_queued() {

    sphinksRequest.find({ state: { $eq: global.sphinksRequest_QUEUED } })
        .exec()                   // execute the query
        .then(requests => {
            debugLog("handle_queued: " + requests.length);
            if (requests.length > 0) {
                requests[0].exchange();
            }
        })
        .catch(err => {
            log.error('Internal error: %s', err.message);
        })
}

if(isMainThread) {
    let w = new Worker(__filename, {workerData: 0});
    const get_queue_size_interval = 10000;
    const handle_awaiting_funds_interval = 10000;
    const handle_confirming_interval = 10000;
    const handle_queued_interval = config.get('request:queue_processing_interval') * 1000;
    setInterval((a) => get_queue_size(), get_queue_size_interval, workerData);
    setInterval((a) => handle_awaiting_funds(), handle_awaiting_funds_interval, workerData);
    setInterval((a) => handle_confirming(), handle_confirming_interval, workerData);
    setInterval((a) => handle_queued(), handle_queued_interval, workerData);
}