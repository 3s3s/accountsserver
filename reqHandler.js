'use strict';

const utils = require("./utils");
const g_constants = require("./constants");

let isKnownCoin = {};
exports.handle = function(app)
{
    app.post('/', OnRequest);
    
};

let g_reqHandlers = {};
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
            if (g_reqHandlers[strHandle] && JSON.parse(post_data).method == "getbalance" && Date.now()-g_reqHandlers[strHandle]*1 < 3000)
            {
                res.end("");
                return;
            }
            const strHandle = "try "+coin.name+" "+JSON.parse(post_data).method;
            if (JSON.parse(post_data).method == "getbalance")
                g_reqHandlers[strHandle] = Date.now();
                
            utils.log2(strHandle);

            require("./RPC/"+JSON.parse(post_data).method).Run(coin, headers, post_data, res);
        }
        catch(e) {
            utils.log2("OnRequest catch 2: " + e.message);
            utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
                //console.log(result.data);
                res.end(result.data || "");

            });
        }
    }
    catch(e) {
        utils.log2("OnRequest catch 1: " + e.message);
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
    
    FillLast(coin, headers, 100);
    
    async function FillLast(coin, headers, count = 100)
    {
        try {
            await utils.SaveLastTransactions(coin, headers, count);
        }
        catch(e) {
            utils.log2('FillLast catch error for '+coin.name+" "+(e.message || ""));
            utils.Offline(coin.name, true);
        }
        
        console.log('WAIT 60 sec for '+coin.name);    
        setTimeout(FillLast, 60000, coin, headers, 100);
    }
}

