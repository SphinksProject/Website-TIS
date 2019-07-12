var log = require('./log')(module);

var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var passport = require('passport');

var libs = process.cwd() + '/libs/';
require(libs + 'auth/auth');

var config = require('./config');
var oauth2 = require('./auth/oauth2');

var api = require('./routes/api');
var users = require('./routes/users');
var articles = require('./routes/articles');
var sphinks = require('./routes/sphinks');
var rates = require('./routes/rates');
var bitcoin = require("./model/bitcoin");
var cors = require('cors');

var app = express();
app.use(cors());
app.options('*', cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());

app.use('/', api);
app.use('/api', api);
//app.use('/api/users', users);
//app.use('/api/articles', articles);
app.use('/api/oauth/token', oauth2.token);

app.use('/api/rates', rates);
app.use('/api/sphinks', sphinks);

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
    res.status(404);
    log.debug('%s %d %s', req.method, res.statusCode, req.url);
    res.json({
        error: 'Not found'
    });
    return;
});

// Error handlers
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    log.error('%s %d %s', req.method, res.statusCode, err.message);
    res.json({
        error: err.message
    });
    return;
});

module.exports = app;
