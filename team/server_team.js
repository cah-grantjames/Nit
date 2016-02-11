module.exports = function(nerver){
    var express = require('express');
    var app = express();
    app.nerver = nerver;
    var fs = require('fs');
    var nettings = require(__dirname + '/../lib/nit_settings.js')().load();
    var inputReceiver = require(__dirname + '/lib/input_receiver.js')(nettings);
    var port = nettings.nerver.team.port;
    app.use(express.static(__dirname + '/public'));

    app.get('/test', function(req, res){
        res.send('team works');
    });
    var server = require('http').createServer(app);
    //
    var io = require('socket.io').listen(server);
    var sockets = [];
    io.sockets.on('connection', function (socket) {
        console.log('Connection establish:', socket.id);
        var found = false;
        for(var i=0; i<sockets.length; i++) {
            if(sockets[i].id == socket.id){
                sockets[i] = socket;
                found = true;
                break;
            }
        }
        if(!found) {
            sockets.push(socket);
        }

        // sending a message back to the client
        socket.emit('connected', { serverType: 'team', message: 'connected', isLoggedIn: nerver.isLoggedIn, projectKey: nettings.projectKey});

        socket.lastCheckSum = 0;
    });

    app.inputListener = {
        onData : function(data, projectKey, fromUpdate, whichData){
            var eventKey = fromUpdate ? ("update_"+whichData) : 'update_pending';
            if(projectKey===nettings.projectKey){
                inputReceiver.handleEvent(eventKey, data);
                for(var i=0; i<sockets.length; i++){
                    try{
                        sockets[i].emit(eventKey, data);
                        sockets[i].emit("server_cache", inputReceiver.cache);
                    } catch(e){
                        console.log(e);
                    }
                }
            }
        }
    };
    require('./lib/input_team.js')(app);
    ///
    server.listen(port);
    console.log('listening on ' + port);
    inputReceiver.cacheSaver.loadCache();

    setInterval(function(){
        inputReceiver.cacheSaver.saveCache();
        for(var i=0; i<sockets.length; i++){
            try{
                sockets[i].emit("server_cache", inputReceiver.cache);
            } catch(e){
                console.log(e);
            }
        }
    }, 30000);

}