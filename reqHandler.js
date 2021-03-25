'use strict';

const utils = require("./utils");
const g_constants = require("./constants");

let isKnownCoin = {};
exports.handle = function(app)
{
    app.post('/', OnRequest);
    
};

async function OnRequest(req, res)
{
    try
    {
        const coin = JSON.parse(new Buffer(req.headers['coin-info'], 'base64').toString('ascii'));
        
        const auth = req.headers['authorization'];
        
        let post_data = await processPost(req, res);
        //console.log('auth: '+auth+'\ncoin:'+JSON.stringify(coin)+'\nPOST:'+post_data+"\n");
        
        const headers = {
            'Content-Type': 'text/plain', 
            'Authorization': auth
        }

        if (!isKnownCoin[coin.name])
            FillData(coin, headers);
        
        try {
            console.log("try "+coin.name+" "+JSON.parse(post_data).method)
            //res.end("");
            require("./RPC/"+JSON.parse(post_data).method).Run(coin, headers, post_data, res);
        }
        catch(e) {
            console.log("catch: " + e.message);
            utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
                //console.log(result.data);
                res.end(result.data || "");

            });
        }
    }
    catch(e) {
        res.end("");
    }
}

function processPost(request, response) 
{
    let queryData = "";
    return new Promise(ok => {
        request.on('data', data => {
            queryData += data;
            if(queryData.length > 1e6) {
                queryData = "";
                response.writeHead(413, {'Content-Type': 'text/plain'}).end();
                request.connection.destroy();
            }
        });
    
        request.on('end', () => {
            ok(queryData);
        });
    });
}

async function OneInit()
{

}

async function FillData (coin, headers)
{
    OneInit();
    
    isKnownCoin[coin.name] = true;

    //FillAll(coin, headers);
    
    FillLast(coin, headers, 1000);
    
    async function FillLast(coin, headers, count = 1000)
    {
        try {
            await utils.SaveLastTransactions(coin, headers, count);
        }
        catch(e) {
            console.log('FillLast catch error for '+coin.name+" "+(e.message || ""));
            utils.Offline(coin.name, true);
        }
        
        console.log('WAIT 60 sec for '+coin.name);    
        setTimeout(FillLast, 60000, coin, headers, 1000);
    }
}

