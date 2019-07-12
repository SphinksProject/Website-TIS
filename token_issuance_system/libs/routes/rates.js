var express = require('express');
var router = express.Router();

var libs = process.cwd() + '/libs/';
var log = require(libs + 'log')(module);

var Client = require('node-rest-client').Client;
var client = new Client();

client.registerMethod("bitcoin", "https://api.coinmarketcap.com/v1/ticker/bitcoin/", "GET");
client.registerMethod("ethereum", "https://api.coinmarketcap.com/v1/ticker/ethereum/", "GET");

var EventEmitter = require("events").EventEmitter;
var btc_json = new EventEmitter();
var eth_json = new EventEmitter();

//btc_json.on('update', function () {});
//eth_json.on('update', function () {});

global.btc_rate = 0;
global.eth_rate = 0;

router.get("/btc", (req, res) => {

    if (btc_json.data == undefined) {
        res.json({
            msg: 'BTC data is not ready'
        });

        return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.send(btc_json.data[0]);

});

router.get("/eth", (req, res) => {

    if (eth_json.data == undefined) {
        res.json({
            msg: 'ETH data is not ready'
        });

        return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.send(eth_json.data[0]);

});

module.exports = router;

// Thread code which gets rates with pre-defined interval

const { Worker, isMainThread,  workerData } = require('worker_threads');

let interval = 10000;

function get_rates(){

    var btc_req = client.methods.bitcoin(function (data, response) {
        btc_json.data = data;
        btc_json.emit('update');
        global.btc_rate = parseFloat(btc_json.data[0].price_usd);
    });

    btc_req.on('error', function (err) {
        log.error('Failed to get ETH rates!!', err.request.options);
    });

    var eth_req = client.methods.ethereum(function (data, response) {
        eth_json.data = data;
        eth_json.emit('update');
        global.eth_rate = parseFloat(eth_json.data[0].price_usd);
    });

    eth_req.on('error', function (err) {
        log.error('Failed to get ETH rates!!', err.request.options);
    });
}

if(isMainThread) {
    get_rates(); // run this as the thread starts
    setInterval((a) => get_rates(), interval, workerData);
}

