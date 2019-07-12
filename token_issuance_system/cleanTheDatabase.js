var libs = process.cwd() + '/libs/';
var log = require(libs + 'log')(module);

/*
var User = require(libs + 'model/user');
var Client = require(libs + 'model/client');
var AccessToken = require(libs + 'model/accessToken');
var RefreshToken = require(libs + 'model/refreshToken');

User.remove({}, function (err) {
    if (err) {
        return log.error(err);
    }
});

Client.remove({}, function (err) {
    if (err) {
        return log.error(err);
    }
});

AccessToken.remove({}, function (err) {
    if (err) {
        return log.error(err);
    }
});

RefreshToken.remove({}, function (err) {
    if (err) {
        return log.error(err);
    }
});
*/

var sphinksRequest = require('./libs/model/sphinksRequest');
var bitcoinRecord = require('./libs/model/bitcoinRecord');

sphinksRequest.remove({}, function (err) {
    if (err) {
        console.log("Failed to remove sphinksRequest: " + err.message);
    }
});

bitcoinRecord.remove({}, function (err) {
    if (err) {
        console.log("Failed to remove bitcoinRecord: " + err.message);
    }
});


