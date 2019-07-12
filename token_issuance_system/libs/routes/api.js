var express = require('express');
var passport = require('passport');
var router = express.Router();
var app = express();
var fs = require('fs');
var url = require("url");

const walletFolder = './wallet/';
const fileNameHead = 'SphinksTokenWallet-v';
const fileNameTail = '.zip';

router.get('/', passport.authenticate('bearer', { session: false }), function (req, res) {

    res.json({
        msg: 'API is running'
    });
});

router.get("/clean", (req, res) => {
    res.json({
        msg: 'API is running'
    });
});

function getFileName() {
    var fileName = undefined;

    fs.readdirSync(walletFolder).forEach(file => {
        if (fileName === undefined && file.startsWith(fileNameHead) && file.endsWith(fileNameTail))
        {
            fileName = file;
        }
    });

    return fileName;
}

router.get("/wallet", (req, res) => {

    var fileName = getFileName();

    if (fileName === undefined)
    {
        res.json({
            msg: 'File not found'
        });
        return;
    }

    fs.readFile(walletFolder + fileName, function (err, content) {
        if (err) {
            res.writeHead(400, {'Content-type':'text/html'})
            log.err(err);
            res.end("No such file");
        } else {
            //specify Content will be an attachment
            res.setHeader('Content-disposition', 'attachment; filename='+ fileName);
            res.end(content);
        }
    });
});

router.get("/wallet-version", (req, res) => {

    var fileName = getFileName();

    if (fileName === undefined)
    {
        res.json({
            msg: 'File not found'
        });
        return;
    }

    var versionName = fileName.substring(fileNameHead.length, fileName.length - fileNameTail.length);

    res.json({
        name: versionName,
        html_url: req.protocol + '://' + req.get('host') + '/api/wallet'
    });

});

module.exports = router;
