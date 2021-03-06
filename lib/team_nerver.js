module.exports = function(nira){
    var NERVER = {};
    NERVER.nira = nira;
    NERVER.period = 60000*10;//10 minutes
    NERVER.hasInitialized = false;
    NERVER.progressSize = Math.floor(15000/NERVER.period);

    NERVER.prompt = function(cb) {
        var prompt = require('prompt');

        var properties = [
        {
            name: 'username'
        },
        {
            name: 'password',
            hidden: true
        }
        ];

        prompt.start();

        prompt.get(properties, function (err, result) {
            if (err) { return onErr(err); }
            NERVER.nira.login(result.username, result.password, function(isLoggedIn){
                cb && cb(isLoggedIn);
            });
        });

        function onErr(err) {
            NERVER.consoleLog(err);
            return 1;
        }
    };


    NERVER.start = function(arg) {

        if(arg === "x" || arg === "-x" || arg === "silent"){
            NERVER.silent = true;
        }
        NERVER.prompt(function(isLoggedIn) {
            NERVER.listen(isLoggedIn);
        });
        return NERVER;
    };

    NERVER.listen = function(isLoggedIn){
        NERVER.isLoggedIn = isLoggedIn;
        NERVER.onStart();
        NERVER.startTime = (new Date().getTime());
        require(__dirname+"/../team/server_team.js")(NERVER);
        NERVER.runInterval = setInterval(function() {

            if(NERVER.shouldEnd()){
                clearInterval(NERVER.runInterval);
                NERVER.consoleLog("Team Nerver session ended.");
                process.exit();
                return;
            }

            NERVER.writeProgress();
        }, NERVER.period);
    };

    NERVER.shouldEnd = function(){
        return false
    };

    NERVER.writeProgress = function() {
        if(NERVER.hasInitialized && !NERVER.silent){
            if(NERVER.counter % NERVER.progressSize === 0){
                NERVER.initWriteProgress();
            }
        }
    };

    NERVER.initWriteProgress = function(){
        if(!NERVER.silent) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
        }
    };

    NERVER.onStart = function(){
        NERVER.clearScreen();
         NERVER.consoleLog("\n\n");
        if(!NERVER.isLoggedIn){
            NERVER.consoleLog("Not Logged in");
        }else {
            NERVER.consoleLog("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            NERVER.consoleLog("!!!!!!!!!!Logged in!!!!!!!!!!");
            NERVER.consoleLog("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        }
        NERVER.consoleLog("Team Nerver is listening...\n\n\n");
        setTimeout(function(){NERVER.hasInitialized = true; NERVER.initWriteProgress(); }, 1550);
    };

    NERVER.write = function(str) {
        if(!NERVER.silent) {
            process.stdout.write(str);
        }
    };

    NERVER.consoleLog = function(str) {
        if(!NERVER.silent) {
            console.log(str);
        }
    }

    NERVER.clearScreen = function(){
        var numLines = process.stdout.getWindowSize()[1];
        NERVER.cursorUp(numLines, false);
    };

    NERVER.cursorUp = function up (i, save) {
        i = i || 1;
        if (i > 0) {
            while(i--) {
                process.stdout.write(!save ? '\033[K\033[1A\r' : '\033[1A\r');
            }
        }
        process.stdout.cursorTo(0);
    };
    return NERVER;
};
