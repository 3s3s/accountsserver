'use strict';

const g_constants = require('./constants');
const g_utils = require('./utils');
const WebSocket = require('ws');

let g_wsPool = [];
let g_mapIdToCallback = {};

let g_LastNewSocket = 0;

function InitSocketPool()
{
    if (g_wsPool.length) return;

    return new Promise(async ok => {
        g_wsPool = new Array(10)
        for (let i=0; i<10; i++)
            await NewSocket(i); 
            
        setInterval(DeleteTimeouts, 5000);
        setInterval(Log, 60000);
        
        g_LastNewSocket = Date.now();
        return ok();
    })

    function Log()
    {
        g_utils.log_db("Queue="+Object.keys(g_mapIdToCallback).length);
    }
    function DeleteTimeouts()
    {
        let keys = [];
        for (let key in g_mapIdToCallback)
        {
            if (g_mapIdToCallback[key].time && Date.now()-g_mapIdToCallback[key].time > 20000)
            {
                const callback = g_mapIdToCallback[key].callback;
                const cancel = g_mapIdToCallback[key].cancel;
                
                if (callback) setTimeout(callback, 1, new Error('sql timeout'), []);
                if (cancel && !callback) setTimeout(cancel, 1);
                
                //delete g_mapIdToCallback[key];
                //break;
                keys.push(key)
            }
        }
        for (let i=0; i<keys.length; i++)
            delete g_mapIdToCallback[keys[i]];
    }

    function NewSocket(index)
    {
        return new Promise((ok, cancel) => {
            if (g_wsPool[index])
            {
                g_utils.log_db("return because duplicate index="+index)
                return ok();
            }
            if (Date.now() - g_LastNewSocket < 1000)
            {
                setTimeout(NewSocket, 1000, index);
                return ok();
            }
            
            if (g_LastNewSocket > 0)    
                g_LastNewSocket = Date.now();
            
            try
            {
                g_utils.log_db("try new socket index="+index+'; ws://'+g_constants.DOMAIN+':'+g_constants.PORT_DB);
                
                const client = new WebSocket('ws://'+g_constants.DOMAIN+':'+g_constants.PORT_DB);
                
                client['index'] = index;
                client['lastAction'] = Date.now();
                
                g_wsPool[index] = client;
            
                client.on('open', () => {
                    g_utils.log_db("socket is opened index="+client.index)
                    
                    //client.ping(() => {});
                    //heartbeat(client);
                    return ok();
                });
                /*client.on('pong', () => {
                    
                    heartbeat(client);
                    
                    setTimeout(() => {
                        client.ping(() => {})
                        heartbeat(client)
                    }, 10000);
                })*/
                client.on('ping', () => {
                    //heartbeat(client)
                    client.pong(() => {});
                });
                client.on('close', async () =>  
                {
                    g_utils.log_db("close socket index="+client.index);
                    setTimeout(NewSocket, 1000, client.index);
                    clearTimeout(client.pingTimeout);
                    
                    client.terminate();
                    g_wsPool[client.index] = null;
                 
                    return ok();
                }); 
                client.on('error', err => {
                    g_utils.log_db("close socket (error) index="+client.index);
                    setTimeout(NewSocket, 1, client.index);
                    clearTimeout(client.pingTimeout);
                    
                    client.terminate();
                    g_wsPool[client.index] = null;
                 
                    return ok();
                });
                client.on('message', data => {
                    //heartbeat(client);
                    if (!data) return;
                    setTimeout(ProcessMessage, 1, data);
                });
            }
            catch(e)
            {
                g_utils.log_db(e.message);
            }
            
        })
        
        function heartbeat(client) {
          clearTimeout(client.pingTimeout);
            
          // Use `WebSocket#terminate()` and not `WebSocket#close()`. Delay should be
          // equal to the interval at which your server sends out pings plus a
          // conservative assumption of the latency.
          client.pingTimeout = setTimeout(() => {
              g_utils.log_db("Terminate (ping timeout) socket index="+client.index);
              client.terminate();
              g_wsPool[client.index] = null;
          }, 20000);
        }
        
        function ProcessMessage(data)
        {
            //console.log("try ProcessMessage")
            try {
                DeleteTimeouts();
                
                const message = JSON.parse(data);
        
                //console.log(g_mapIdToCallback)
                
                if (!message.id) return;
                if (!g_mapIdToCallback[message.id]) return;
                
                const callback = g_mapIdToCallback[message.id].callback;
                if (!callback) 
                    return (delete g_mapIdToCallback[message.id]);

                console.log("got callback")
                callback(message.err, message.rows || []);
        
                delete g_mapIdToCallback[message.id];
            }
            catch(e) {
                g_utils.log_db("catch error (2) = "+e.message);
            }
        }
    }
    
}

async function GetSocketFromPool(callback)
{
    const index = getRandomInt();
    const socket = g_wsPool[index];
    
    if (socket && (socket.readyState === WebSocket.OPEN))
    {
        return setTimeout(callback, 10, socket);
    }

    g_utils.log_db("index="+index+" is not open");
    
    /*if (socket['lastAction'] && Date.now() - socket['lastAction'] > 1000*30)
    {
        g_utils.log_db("terminate socket (last action was more 30 sec) index="+index);
        clearTimeout(socket.pingTimeout);
                
        socket.terminate();
    }*/

    setTimeout(GetSocketFromPool, 1000, callback);

    function getRandomInt(min = 0, max = 10) 
    {
        //if (g_LastActiveIndex != -1)
        //    return g_LastActiveIndex;
        
        return Math.floor(Math.random() * (max - min)) + min;
    }
}

async function remoteInit()
{
    await InitSocketPool();

    return new Promise((ok, cancel) => {
        const id = Math.random();
        g_mapIdToCallback[id] = {time: Date.now(), callback: InitFunctions};
        const strJSON = JSON.stringify({id: id, q: JSON.stringify(
            {
                dbPath: g_constants.dbName, 
                command: "init",
                dbStructure: {dbTables: g_constants.dbTables, dbIndexes: g_constants.dbIndexes}
            }
        )});
        
        GetSocketFromPool(socket => {
            try{ socket.send(strJSON); } catch(e){socket.terminate();}
            return ok();
        });
    });
}

function remoteRun(SQL, callback)
{
    //console.log(SQL)
    if (Object.keys(g_mapIdToCallback).length > 2)
        return setTimeout(remoteRun, 1000, SQL, callback);
        
    const id = 1+Math.random();
    g_mapIdToCallback[id] = {time: Date.now(), callback: callback};
        
    const strJSON = JSON.stringify({id: id, q: JSON.stringify(
        {
            dbPath: g_constants.dbName, 
            command: "sql",
            sql: SQL
        }
    )});
        
    GetSocketFromPool(socket => {
        //g_utils.log_db(strJSON)
        try { socket.send(strJSON); } 
        catch(e){
            g_utils.log_db("catch error (1) = "+e.message);
            socket.terminate(); 
            if (g_mapIdToCallback[id]) delete g_mapIdToCallback[id];
            setTimeout(remoteRun, 100, SQL, callback);
        }
    });
}

let globalCallback = null;
exports.Init = async function(callback)
{
    g_utils.log_db("Init 0");
    globalCallback = callback;
    await remoteInit();
    
    g_utils.log_db("Init 1");
}

function InitFunctions()
{
    g_utils.log_db("InitFunctions");
    //const globalCallback = callback;
    
    //await remoteInit();
    
    //g_db = new sqlite3.Database(g_constants.dbName);
    
    //remoteRun('DROP TABLE posts');
    //g_db.run('ALTER TABLE orders ADD COLUMN uuid TEXT UNIQUE')
    
    function CreateIndex(indexObject)
    {
        //g_db.run("CREATE INDEX IF NOT EXISTS "+indexObject.name+" ON "+indexObject.table+" ("+indexObject.fields+")", function(err){
        remoteRun("CREATE INDEX IF NOT EXISTS "+indexObject.name+" ON "+indexObject.table+" ("+indexObject.fields+")", err => {
            if (err) throw new Error(err.message);
        });
    }
    
    function CreateTable(dbTables, nIndex, cbError)
    {
        var cols = ' (';
        for (var i=0; i<dbTables[nIndex].cols.length; i++) {
            cols += dbTables[nIndex].cols[i][0] + ' ' + dbTables[nIndex].cols[i][1];
            
            if (i != dbTables[nIndex].cols.length-1)
                cols += ', ';
        }
        
        if (dbTables[nIndex].commands) cols += ", "+dbTables[nIndex].commands;
    
         cols += ')';
        
        //console.log('CREATE TABLE IF NOT EXISTS ' + dbTables[nIndex].name + cols) 
         //g_db.run('CREATE TABLE IF NOT EXISTS ' + dbTables[nIndex].name + cols, function(err) {
         remoteRun('CREATE TABLE IF NOT EXISTS ' + dbTables[nIndex].name + cols, err => {
            if (!err)
                return cbError(false);

            console.log(err.message);
            cbError(true);
         });
    }
    
    function Delete(table, where, callback)
    {
        try
        {
            //g_db.run('DELETE FROM ' + table + ' WHERE ' + where, function(err) {
            remoteRun('DELETE FROM ' + table + ' WHERE ' + where, err => {
                if (callback) setTimeout(callback, 1, err); //callback(err)
                if (!err) 
                    return;
                console.log('DELETE error: ' + err.message);
            });
            
        }
        catch(e)
        {
            if (callback) setTimeout(callback, 1, e); //callback(e);
            console.log(e.message);
        }
    }
    
    function Insert(tableObject, values)
    {
        InsertCommon(tableObject, values, false);
    }
    function Insert2(tableObject, values)
    {
        InsertCommon(tableObject, values, true);
    }
    function InsertCommon(tableObject, values, bToMemory)
    {
        try {
            var callbackERR = values[values.length-1];
            
            if (values.length-1 != tableObject.cols.length ) {
                g_utils.log2('ERROR: Insert to table "'+tableObject.name+'" failed arguments count: ' + (values.length-1));
                
                return setTimeout(callbackERR, 1, true); //callbackERR(true);
            }
            
            var vals = ' (';
            for (var i=0; i<values.length-1; i++) {
                vals += "'" + escape(values[i]) + "'";
                
                if (i != values.length-2)
                    vals += ', ';
            }
            vals += ')';
            
            //console.log('INSERT INTO ' + tableObject.name + ' VALUES ' + vals);
            g_utils.log2("REPLACE INTO ' + tableObject.name + ' VALUES ' + vals");
            /*if (bToMemory)
            {
                exports.addMemQuery('INSERT INTO ' + tableObject.name + ' VALUES ' + vals);
                setTimeout(callbackERR, 1, false);//callbackERR(false);
            }
            else
            {*/
                //g_db.run('INSERT INTO ' + tableObject.name + ' VALUES ' + vals, err => {
                remoteRun('REPLACE INTO ' + tableObject.name + ' VALUES ' + vals, err => {
                    if (callbackERR) setTimeout(callbackERR, 1, err); //callbackERR(err);
                    if (err) 
                        g_utils.log2('INSERT error: ' + err.message);
                    else
                        g_utils.log2('INSERT success');
                });
            //}
        }
        catch(e) {
            g_utils.log2("INSERT cath error:" + e.message);
            if (callbackERR) setTimeout(callbackERR, 1, e); //callbackERR(e);
        }
    }
    function SelectAll(cols, table, where, other, callback, param) 
    {
        try {
            let query = "SELECT " + cols + " FROM " + table;
            if (where.length)
                query += " WHERE " + where;
            if (other.length)
                 query += " " + other; 
                 
            if (!callback) 
                console.log("WARNING: SelectAll callback undefined!!!");

            //g_db.all(query, param, (err, rows) => {
            remoteRun(query, (err, rows) => {
                if (err) 
                {
                    try {
                        console.log("SELECT ERROR: query="+query+" message=" + JSON.stringify(err));
                    }catch(e) {
                        console.log(e.message)
                    }
                }
                
                query = null;
                if (callback) setTimeout(callback, 1, err, rows);
            });
        }
        catch (e) {
            console.log(e.message);
            if (callback) setTimeout(callback, 1, e, []); //callback(e);
        }
    }
    function Update(tableName, SET, WHERE, callback)
    {
        try {
            let query = 'UPDATE ' + tableName;
            console.log(query); 
            
            if (!SET || !SET.length)  throw new Error("Table Update MUST have 'SET'");
            if (!WHERE || !WHERE.length) throw new Error("Table Update MUST have 'WHERE'");
                
            query += ' SET ' + SET;
            query += ' WHERE ' + WHERE;
            
            //console.log(query);   
            //g_db.run(query, function(err) {
            remoteRun(query, err => {
                //console.log(err)
                if (callback) setTimeout(callback, 1, err); //callback(err);
                if (err) console.log("UPDATE error: " + err.message);
            });
        }
        catch(e) {
            console.log(e.message);
            if (callback) setTimeout(callback, 1, e); //callback(e);
        }
    }
    
    //g_db.parallelize(() => {
        
        g_utils.ForEachSync(g_constants.dbTables, CreateTable, err => {
            if (err) throw new Error('unexpected init db error 2');
            
            if (g_constants.dbIndexes)
            {
                for (var i=0; i<g_constants.dbIndexes.length; i++)
                    CreateIndex(g_constants.dbIndexes[i]);
            }

            g_constants.dbTables['KeyValue']['get'] = function(key, callback) {
                SelectAll("value", this.name, "key='"+escape(key)+"'", "", function(error, rows) {
                    if (rows && rows.length && rows[0].value) 
                        callback(error, unescape(rows[0].value));
                    else
                        callback(error, "");
                });
            };
            g_constants.dbTables['KeyValue']['set'] = function(key, value, callback) {
                this.get(key, (error, rows) => {
                    if (error || (!rows.length))
                        g_constants.dbTables['KeyValue'].insert(key, value, callback);
                    if (!error && rows.length)
                        g_constants.dbTables['KeyValue'].update("value = '"+escape(value)+"'", "key='"+escape(key)+"'", callback);
                });
            };
            
            if (globalCallback)
                globalCallback();
                
        }, (err, params, cbError) => {
            if (err) throw new Error('unexpected init db error 1');
            
            const i = params.nIndex;
            
            g_constants.dbTables[g_constants.dbTables[i]['name']] = g_constants.dbTables[i];
           
            g_constants.dbTables[i]['insert'] = function() {
                Insert(this, arguments);};
            g_constants.dbTables[i]['insert2'] = function() {
                Insert2(this, arguments);};

            g_constants.dbTables[i]['Insert'] = function() {
                let args = [];
                for (let i = 0; i < arguments.length; i++) {
                  args[i] = arguments[i];
                }
                return new Promise((fulfilled, rejected) => {
                    args.push(err => { 
                        if (err) return rejected( new Error(err.message || "Insert error") );
                        fulfilled(null);
                    });
                    Insert(this, args);
                });
            };
            
            g_constants.dbTables[i]['update'] = function(SET, WHERE, callback) {
                Update(this.name, SET, WHERE, callback);};
            
            g_constants.dbTables[i]['Update'] = function(SET, WHERE) {
                const name = this.name;
                return new Promise((fulfilled, rejected) => {
                    Update(name, SET, WHERE, err => {
                        if (err) return rejected( new Error(err.message || "Update error") );
                        fulfilled(null);
                    });
                });
             };
            
            g_constants.dbTables[i]['delete'] = function(WHERE, callback) {
                Delete(this.name, WHERE, callback);};
            
            g_constants.dbTables[i]['selectAll'] = function(cols, where, other, callback, param) {
                SelectAll(cols, this.name, where, other, callback, param);};
            
            g_constants.dbTables[i]['Select'] = function(cols, where = "", other = "", param) {
                const name = this.name;
                return new Promise((fulfilled, rejected) => {
                    SelectAll(cols, name, where, other, (err, rows) => {
                        if (err || !rows) return rejected( new Error(err && err.message ? err.message : "Select error") );
                        fulfilled(rows);
                    }, param);
                });
            };
            g_constants.dbTables[i]['Select2'] = function(cols, where = "", other = "", param) {
                const name = this.name;
                return new Promise(fulfilled => {
                    SelectAll(cols, name, where, other, (err, rows) => {
                        if (err || !rows) return fulfilled([]);
                        console.log("select return no error");
                        fulfilled(rows);
                    }, param);
                });
            };
            
            cbError(false);
        });
    //});
};

exports.RunQuery = function(SQL, callback)
{
   // g_db.run(SQL, callback);
    remoteRun(SQL, callback);
}
exports.SELECT = function(query, callback)
{
    return new Promise(ok => {
        remoteRun(query, (err, rows) => {
            if (err) console.log("SELECT ERROR: query="+query+" message=" + err.message);
                    
            query = null;
            if (callback) setTimeout(callback, 1, err, rows);
            else ok({err: err, rows: rows});
        });   
        
    })
}



