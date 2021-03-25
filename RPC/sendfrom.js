'use strict';
const utils = require("../utils");
const getbalance = require("./getbalance");
const getnewaddress = require("./getnewaddress");

exports.Run = async function(coin, headers, post_data, res)
{
    if (utils.IsOffline(coin.name))
        return res.end(JSON.stringify({error: { message: 'coin offline'} }));

    try
    {
        const data = JSON.parse(post_data);
        
        if (!data.params || data.params.length < 3 || 1*data.params[2] < 0)
            return res.end(JSON.stringify({error: { message: 'bad params' }}));

        let balance = await getbalance.GetAccountBalance(coin, data.params[0]);

        if (1*balance < 1*data.params[2])
            return res.end(JSON.stringify({error: { message: 'insufficient funds for account '+data.params[0]+': ('+1*balance+' < '+1*data.params[2]+')'} }));
        
        let newData = data;
        newData.method = "sendtoaddress";
        
        if (data.params.length <= 4)
            return res.end(JSON.stringify({error: { message: 'bad send request'} }));
        
        if (data.params.length == 5)
            newData.params = [data.params[1], data.params[2], data.params[4], data.params[1]];
        if (data.params.length == 6)
            newData.params = [data.params[1], data.params[2], data.params[5], data.params[1]];
            
        const newAddress = await getnewaddress.queryDaemon(coin, headers);
        
        if (newAddress.length == 0)
            return res.end(JSON.stringify({error: { message: 'error when getting new address'} }));
        
        utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, JSON.stringify(newData), async result => {
            if (!result.data || !result.data.length)
                return res.end(JSON.stringify({error: { message: 'sendtoaddress failed'} }));
            
            await utils.SaveLastTransactions(coin, headers, 5);   
            
            return res.end(result.data || "");
            
        });
    }
    catch(e)
    {
        return res.end(JSON.stringify({error: { message: 'sendtoaddress catch error '+e.message} }));
        /*utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
            console.log(result.data);
            
            if (result.success == false)
                return res.end(JSON.stringify({error: { message: result.message || 'sendfrom failed'} }));
            
            res.end(result.data || "");
        });*/
    }

}