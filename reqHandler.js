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
    /*await g_constants.dbTables["addresses"].Update(
                            "address='DGuKiG71YVExe78tM5msHQmSFieo4h94Ca_1'",
                            "uid='lfF1o9Qktpor2lOYe+kgNT4r4IUEY1e/QWr8aRXi7+Y%3D'"
                        );
    await g_constants.dbTables["addresses"].Update(
                            "address='DGuKiG71YVExe78tM5msHQmSFieo4h94Ca_2'",
                            "uid='W9ZL2atedvjdAQiAj9W/6QwX/zFoG2AY0sDWMxQ8MuA%3D'"
                        );
    await g_constants.dbTables["addresses"].Update(
                            "address='HXSii8hrVJCTPKzQtq5NzKRUQ6pH34HAMY_1'",
                            "uid='DXSRB8kRdUKjQ/+3dG/O297ZxfyyXR4J2ntaed86d3k%3D'"
                        );
    await g_constants.dbTables["addresses"].Update(
                            "address='MTh7Qh2kT6aRe4isJqrDFdisXu26y5ZVCG_1'",
                            "uid='21c47mfVbsv4Eer36BsrIIP6gw1QZnjZj88JYmYn2Pc%3D'"
                        );
    await g_constants.dbTables["addresses"].Update(
                            "address='DJm1CqgohEUo94SpSr26tLUAE2Lr55v6si_1'",
                            "uid='zMMf5vCWeMbSvnSweYzrc29CvniitTdcZU9h+5ILyss%3D'"
                        );
    await g_constants.dbTables["addresses"].Update(
                            "address='DHP4LLGg8QTmwctmtrV8U4xU8oE13S7ZJf_1'",
                            "uid='XYlGCEcAmXq6QQPM5uxDavQkygFhkG3X+4DZQNDA8FU%3D'"
                        );
    await g_constants.dbTables["addresses"].Update(
                            "address='PEh81T3C1NCSZMCVTUCv4uoKfpR5Zx6TaF_1'",
                            "uid='UT9k1uQVOM3WS9sgo6i+jrRj+z3VCCUBQ1B7ebjjlmg%3D'"
                        );*/
    
}

async function FillData (coin, headers)
{
    OneInit();
    
    isKnownCoin[coin.name] = true;

    //FillAll(coin, headers);
    
    FillLast(coin, headers, 1000);
    
    //await g_constants.dbTables["addresses"].delete("address='DEvYxD2HRY3HSPoGnRwLN6qHdTpQQUHrJ8'")

    /*async function FillAll(coin, headers, count = 1000)
    {
        try {
            await utils.SaveAllTransactions(coin, headers, count);
        }
        catch(e) {
            console.log("catch error for "+coin.name + " " + (e.message || ""));
        }
        
        console.log('WAIT 120 sec for '+coin.name);
        setTimeout(FillAll, 120000, coin, headers, 50);
    }*/
    
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

