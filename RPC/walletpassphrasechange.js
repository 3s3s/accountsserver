'use strict';
const utils = require("../utils");

exports.Run = function(coin, headers, post_data, res)
{
    utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
        console.log("walletpassphrasechange result = " + result.data);
        
        try
        {
            let data = JSON.parse(post_data);
            
            let result_data = JSON.parse(result.data);
            if (!result_data.error)
                return res.end(result.data || "");
                
            const oldError = '['+data.params[0]+', '+data.params[1]+']: '+result_data.error.message +", ";
 
           // result_data.error.message += "("+JSON.stringify(data.params)+")";
           // result.data = JSON.stringify(result_data);
 
            //return res.end(result.data || "");
            data.method = "encryptwallet";
            data.params = [data.params[1]];
            
            utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, JSON.stringify(data), result => {
                try
                {
                    let result_data2 = JSON.parse(result.data);
                    if (!result_data2.error)
                        return res.end(result.data || "");
                        
                    result_data2.error.message = oldError + result_data2.error.message
                    
                    result.data = JSON.stringify(result_data2);
                    
                    return res.end(result.data);
                    
                }
                catch(e)
                {
                    return res.end(result.data || e.message);
                }
            });
        }
        catch(e)
        {
            return res.end(result.data || e.message);
        }
    });
}