'use strict';
const utils = require("../utils");

exports.Run = function(coin, headers, post_data, res)
{
    utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
        console.log(result.data);
        
        try
        {
            let data = JSON.parse(post_data);
            
            let result_data = JSON.parse(result.data);
            if (!result_data.error)
                return res.end(result.data || "");
 
           // result_data.error.message += "("+JSON.stringify(data.params)+")";
           // result.data = JSON.stringify(result_data);
 
            //return res.end(result.data || "");
            data.method = "encryptwallet";
            data.params = [data.params[1]];
            
            utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, JSON.stringify(data), result => {
                return res.end(result.data || "");
            });
        }
        catch(e)
        {
            return res.end(result.data || "");
        }
    });
}