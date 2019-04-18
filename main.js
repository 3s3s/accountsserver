'use strict';

const g_constants = require('./constants');

const https = require('https');
const util = require('util');
const express = require('express');
const bodyParser = require('body-parser');

const log_file = require("fs").createWriteStream(__dirname + '/debug.log', {flags : 'w'});
const log_stdout = process.stdout;

console.log = function(d, userID) { 
    if (!g_constants.DEBUG_LOG)
        return;

  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
  
  if (userID)
    require("./utils").log_user(userID, d);
};

const app = express();
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 
app.use(express.static('./static_pages'));


var httpsServer = https.createServer(g_constants.SSL_options, app);

var httpsListener = httpsServer.listen(g_constants.share.my_port, () => {
    console.log("Proxy listening on port "+g_constants.share.my_port);
});

var lastSocketKey = 0;
var socketMap = {https: {}};

httpsListener.on('connection', socket => {
    socket.setTimeout(1000 * 60 * 10); // 10 min
    /* generate a new, unique socket-key */
    const socketKey = ++lastSocketKey;
    /* add socket when it is connected */
    socketMap.https[socketKey] = socket;
    socket.on('close', function() {
        /* remove socket when it is closed */
        //g_constants.ReleaseAddress(socketMap.https[socketKey].remoteAddress);
        delete socketMap.https[socketKey];
    });
    
    if (!g_constants.IsAllowedAddress(socket.remoteAddress))
        socket.end();
});

process.on('uncaughtException', err => {
  console.error(err.stack);
  console.log("Node NOT Exiting...");
  require("fs").writeFileSync(__dirname + '/debug'+Date.now()+'.log', err.stack);

  process.exit(0);
});

app.use((err, req, res, next) => {
    res.send(500, 'Something broke!');
});

require("./database").Init(() => {
    require('./reqHandler.js').handle(app);
});
