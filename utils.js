'use strict';
const util = require('util');
const http = require('http');
const https = require('https');
const g_crypto = require('crypto');


const log_file_db = require("fs").createWriteStream(__dirname + '/debug_db.log', {flags : 'w'});

exports.log_db = function(d) {
    log_file_db.write(util.format(d) + '\n');
}

exports.Hash = function(str)
{
    return g_crypto.createHash("sha256").update(str).digest('base64');
};

exports.Sleep = function(msec)
{
    return new Promise(ok => {
        setTimeout(ok, msec);
    })
}

let g_offlines = {};
exports.Offline = function(coinName, flag)
{
    g_offlines[coinName] = flag;
}
exports.IsOffline = function(coinName)
{
    return g_offlines[coinName] == true;
}

exports.ForEachSync = function(array, func, cbEndAll, cbEndOne)
{
    if (!array || !array.length)
    {
        console.log('success: ForEachAsync (!array || !array.length)');
        cbEndAll(false);
        return;
    }
    
    Run(0);
    
    function Run(nIndex)
    {
        if (nIndex >= array.length) throw new Error('error: ForEachSync_Run (nIndex >= array.length)');
        func(array, nIndex, onEndOne);
        
        function onEndOne(err, params)
        {
            if (!cbEndOne)
            {
                if (err) return cbEndAll(err);
                
                if (nIndex+1 < array.length && !err)
                    Run(nIndex+1);
                else
                    cbEndAll(false); //if all processed then stop and return from 'ForEachSync'
                return;
            }
            
            if (!params) params = {};
            
            params.nIndex = nIndex;
            
            cbEndOne(err, params, function(error) {
                if (error) {
                    //if func return error, then stop and return from 'ForEachSync'
                    console.log('error: ForEachSync_Run_cbEndOne return error');
                    return cbEndAll(true);
                }
                if (nIndex+1 < array.length)
                    Run(nIndex+1);
                else
                    cbEndAll(false); //if all processed then stop and return from 'ForEachSync'
            });
        }
    }
};

var lastSocketKey = 0;
var socketMap = {};
exports.postString = function(host, port, path, headers, strBody, cd) 
{
    return new Promise((ok, cancel) => {
        
        const callback = cd || ok;

        const options = { 
            hostname: host, 
            port: port.nPort, 
            path: path, 
            method: 'POST', 
            headers: headers
        }; 
        
        if (!port.name)
        {
            var i=0;
        }
        var proto = (port.nPort == 443 || port.name.indexOf('https')==0) ? https : http;
            
        var req = proto.request(options, res => { 
            console.log('Status: ' + res.statusCode); 
            console.log('Headers: ' + JSON.stringify(res.headers)); 
            
            res.setEncoding('utf8'); 
            
    		var res_data = '';
    		res.on('data', chunk => {
    			res_data += chunk;
    		});
    		res.on('end', () => {
    			setTimeout(callback, 10, {'success': 'success', 'data': res_data});
    		});	
        }); 
        
        req.on('socket', socket => {
            socket.setTimeout(30000);  
            socket.on('timeout', function() {
                req.abort();
            });
            
            /* generate a new, unique socket-key */
            const socketKey = ++lastSocketKey;
            /* add socket when it is connected */
            socketMap[socketKey] = socket;
            socket.on('close', () => {
                /* remove socket when it is closed */
                delete socketMap[socketKey];
            });
        });
    
        req.on('error', e => { 
            if (e.code === "ECONNRESET") {
                console.log("Timeout occurs");
            }
            console.log('problem with request: ' + (e.message || "")); 
            setTimeout(callback, 10, {'success': false, message: 'problem with request: ' + (e.message || "")});
        }); 
        
        // write data to request body 
        req.end(strBody);    
        

    })
};
