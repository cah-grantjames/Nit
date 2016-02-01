#!/usr/bin/env node
var cliArgs = process.argv.slice(2);
var runner = new Runner();

if(cliArgs[0] === "setup"){
	var cmd = "npm install && npm install -g bower && cd stats/ && bower install && cd ..";
	child_process = require('child_process');
 
	child_process.exec(cmd, function(err, out, code) {
		if (err instanceof Error)
			throw err;
		process.stdout.write(out);
	});	
	

} else {
	var nit = new Nit(runner);
	nit.start(cliArgs);
}

function Nit(runner) {
    var NIT = this;
    this.runner = runner;

	
	
    this.printer = require(__dirname + '/lib/printer.js')();
    this.nettings = require(__dirname + '/lib/nit_settings.js')().load();
    this.nira = require(__dirname + '/lib/nira/nira.js')(this.nettings);
    this.nerver = require(__dirname + '/lib/nerver.js')(this.nira);
    this.nitClient = require(__dirname + '/lib/nit_client.js')(this.nerver, this.nettings);
    this.log = require(__dirname + '/lib/log.js')(this);
    this.cmds = require(__dirname + '/lib/cmds.js')();

    this.browse = function(currentBranch) {
        var ticket = this.nira.ticketIDFromBranch(currentBranch);
        this.runner.run("open", [this.nira.baseURL + ticket]);
    };

    this.getCommand = function(arg) {
        for(var i=0; i<this.cmds.length; i++){
            if(this.cmds[i].arg === arg){
                return this.cmds[i];
            }
        }
        return undefined;
    };

    this.help = function() {
        var self = this;
        self.printer.logo(__dirname + '/logo');
        for(var i=0; i<this.cmds.length; i++){
            var c = this.cmds[i];
            self.printer.printCmd(c);
        }
    };

    this.start = function(cliArgs){
        var self = this;
        var cmd = cliArgs[0] ? self.getCommand(cliArgs[0]) : self.getCommand("help");
        if(cmd) {
            self.isCleanStatus(function(data, clean, currentBranch){
                if(clean || !cmd.requiresClean){
                    if(cmd.takesArray) {
                        cmd.action(self, cliArgs, currentBranch);
                    } else {
                        cmd.action(self, cliArgs[1], currentBranch);
                    }

                    if(cmd.arg != "updateNerver"){
                        NIT.runner.run("nit", ["updateNerver"]);
                    }
                } else {
                    self.nerrorUnclean();
                }
            });
        } else {
            self.gitInherit(cliArgs);
        }
    };

    this.ciMessageFromArgs = function(argz) {
        var message = "";
        try {
            for(var i=1; i<argz.length; i++) {
                message += " " + argz[i];
            }
        } catch (e) {
            message = "";
        }
        return message.trim();
    };
    //

    this.sts = function() {
        this.gitInherit(["status", "-s"]);
    };

    this.featureCommit = function(message, currentBranch, cb){
        var self = this;
        if(!message){
            self.printer.E("NERROR: Missing a commit message!");
            return;
        }
        if(self.isOnAFeatureBranch(currentBranch)){
            var prefix = currentBranch.replace(self.nettings.featureBranchPrefix, "");
            var msg = prefix + " " + message;
            self.commit(msg, cb);
        } else {
            self.printer.E("NERROR: Cannot commit feature while on non-feature branch '" + currentBranch + "'");
            cb && cb();
        }
    };

    this.commit = function(message, currentBranch){
        var self= this;
        if(!message){
            self.printer.missingCommitMessage();
            return;
        }

        self.changesStagedStatus(function(staged, unstaged, untracked){
            if(staged){
                self.git(["commit", "-m", message], function(){
                    if(unstaged || untracked){
                        self.printer.print("NWARNING: Committed some things, but some changes were not staged to commit!");
                    }
                });
            } else {
                self.printer.E("NERROR: Nothing staged to commit!");
            }
        });
    }

    this.changesStagedStatus = function(cb) {
        var self = this;
        self.status(function(data){
            var staged = data.indexOf("Changes to be committed:") != -1;
            var unstaged = data.indexOf("Changes not staged for commit:") != -1;
            var untracked = data.indexOf("Untracked files:") != -1;
            cb && cb(staged, unstaged, untracked)
        });
    };

    this.isOnAFeatureBranch = function(currentBranch){
        var self = this;
        return currentBranch.indexOf(self.nettings.featurePrefix)!=-1;
    };

    this.updateDevThenMerge = function(currentBranch){
        var self = this;
        if(currentBranch==="develop"){
            self.printer.E("Already on develop.  Did no work.");
            return;
        }

        self.gotoDevelop(currentBranch, function(success) {
            self.git(["pull", "origin", "develop"], function(){
                self.git(["checkout", currentBranch], function(data){
                    self.git(["merge", "develop"], function(data){
                        var alreadyUpStrFound = false;
                        var isAlreadyStr = data.indexOf("Already up-to-date") != -1;

                        if(!isAlreadyStr || !alreadyUpStrFound){
                            self.printer.print(data);
                        }
                        if(isAlreadyStr) {
                            alreadyUpStrFound = true;
                        }
                    });
                });
            });
        });
    };

    this.devMerge = function(currentBranch){
        var self = this;
         if(currentBranch==="develop"){
            self.printer.E("Already on develop.  Did no work.");
            return;
        }

        self.printer.I("Merging develop into " + currentBranch);
        var gitArgs = ["merge", "develop"];
        self.git(gitArgs, function(data){
            console.log(data);
        });
    };

    this.gotoDevelop = function(currentBranch, cb){
         this.createAndCheckoutBranch("develop", currentBranch, cb);
    };

    this.createAndCheckoutFeatureBranch = function(branchName, currentBranch, cb) {
        if(!branchName || branchName.length == 0){
            this.printer.E("NError! Cannot create feature branch ''");
            cb && cb();
            return;
        }
        this.createAndCheckoutBranch(this.nettings.featurePrefix + branchName, currentBranch, cb);
    };

    this.createAndCheckoutBranch = function(branchName, currentBranch, cb){
        var self = this;
        if(currentBranch.trim() != branchName.trim()){
           self.git(["checkout", branchName], function(data){
                var search = "error: ";
                if(data.indexOf(search) === -1){
                    cb && cb();
                } else {
                    self.git(["checkout", "-b", branchName], function(){
                        self.printer.print("Created branch "+branchName+" out of "+currentBranch);
                        cb && cb();
                    });
                }
            });
        } else {
            self.printer.print("Already on " + branchName);
            cb && cb();
        }
    };

    this.onBranch = function(currentBranch){
        var self = this;
        this.status(function(data){
            self.printer.printBranch(self.discoverBranch(data));
        });
    };

    this.setPull = function(branch, cb) {
        this.git(["push", "--set-upstream-to origin/" + branch], cb);
    };

    this.setPush = function(branch, cb) {
        this.git(["push", "--set-upstream-to origin/" + branch], cb);
    };

    this.push = function(branch) {
        var self = this;
        this.git(["push", "origin", branch], function(data){
            self.printer.printPushResult(data);
        });
    };

    this.pull = function(branch) {
        var self = this;
        this.gitInherit(["pull", "origin", branch]);
    };

    this.nerrorUnclean = function() {
        var self = this;
        self.printer.E("NERROR! Unclean status!");
    };

    this.statusPrint = function(cb) {
        NIT.git(["status"], function(statusData){
            currentBranch = NIT.discoverBranch(statusData);
            NIT.printer.printStatus(statusData, currentBranch, NIT.isDetached);
            cb && cb(statusData, currentBranch, NIT.isDetached);
        });
    };

    this.getBranchAndDescribe = function(cb) {
        NIT.git(["status"], function(statusData){
            NIT.describe(NIT.discoverBranch(statusData), cb);
        });
    };

    this.getBranchComments = function(cb) {
        NIT.git(["status"], function(statusData){
            NIT.comments(NIT.discoverBranch(statusData), cb);
        });
    };

    NIT.updateNerver = function(){
        console.log("updateNerver called!");
        NIT.git(["status"], function(status){
            var currentBranch = NIT.discoverBranch(status);
            var issueKey = NIT.nira.ticketIDFromBranch(currentBranch);
            NIT.git(["log", "--pretty=oneline"], function(logs){
                var lineMessages = NIT.getLineMessages(logs);
                NIT.nitClient.sendCmdToServer("issue", {}, currentBranch, issueKey, "jira", true, function(repliedFields){
                    NIT.nitClient.sendCmdToServer("status", status, currentBranch, issueKey, "git", true, function(){
                        NIT.nitClient.sendCmdToServer("one_line_log_data", lineMessages, currentBranch, issueKey, "git", true, function(){
                        });
                    });
                });
            });
        });
    };

    this.describe = function(currentBranch, cb) {
        var self = this;
        NIT.nitClient.sendCmdToServer("issue", {}, currentBranch, self.nira.ticketIDFromBranch(currentBranch), "jira", false, function(repliedFields){
            self.printer.description(self.nira.ticketIDFromBranch(currentBranch), repliedFields);
            cb && cb(self.nira.ticketIDFromBranch(currentBranch), repliedFields);
        });
    };

    this.comments = function(currentBranch, cb) {
        var self = this;
        NIT.nitClient.sendCmdToServer("comments", {}, currentBranch, self.nira.ticketIDFromBranch(currentBranch), "jira", false, function(repliedComments){
            self.printer.comments(repliedComments);
            cb && cb(repliedComments);
        });
    };

    this.createComment = function(comment, currentBranch, cb) {
        var self = this;
//        NIT.nitClient.sendCmdToServer("create_comment", comment, currentBranch, self.nira.ticketIDFromBranch(currentBranch), "user", false, function(){
            cb && cb();
//        });
    };

    this.logOneLiners = function(currentBranch, cb) {
        var self = this;
        self.git(["log", "--pretty=oneline"], function(logs){
            var lineMessages = NIT.getLineMessages(logs);
//            NIT.nitClient.sendCmdToServer("one_line_log_data", lineMessages, currentBranch, self.nira.ticketIDFromBranch(currentBranch), "git", false, function(){
//            });
            self.printer.logOneLiners(logs);
            cb && cb(logs);
        });
    };

    NIT.getLineMessages = function(logs, max) {
        var max = max || 20;
        var lines = logs.split('\n');
        var lineMessages = [];
        var largestLineMessageLength = 0;
        for(var i=0; i<lines.length; i++) {
            var words = lines[i].split(" ");
            var hash = words[0];
            if(hash.length > 0){
                var message = "";
                for(var j=1; j<words.length; j++) {
                    message += " " + words[j];
                }
                message = message.trim();
                var smallHash = hash.substring(0, 7);
                message = (i+1) + " | " + smallHash + " | - | " + message;
                lineMessages.push(message);
                if(lineMessages.length>max)
                    break;
                if(message.length > largestLineMessageLength) {
                    largestLineMessageLength = message.length;
                }
            }
        }
        return lineMessages;
    };

    this.status = function(cb) {
         this.git(["status"], function(status){
            var currentBranch = NIT.discoverBranch(status);
            NIT.nitClient.sendCmdToServer("status", status, currentBranch, NIT.nira.ticketIDFromBranch(currentBranch), "git", false, function(){
            });
            cb && cb(status);
         });
    };

    this.stageFeatureCommitAndStatus = function(message, currentBranch) {
        var self = this;
        if(!message || !currentBranch){
            if(!message){
                self.printer.missingCommitMessage();
            }
            cb && cb();
            return;
        }
        self.stage(function(){
            self.featureCommit(message, currentBranch, function(){
                self.statusPrint();
            });
        });
    };

    this.stage = function(cb) {
        var self = this;
        this.git(["add", "."], function(){
            self.git(["add", "-u"], cb);
        });
    };

    this.isCleanStatus = function(cb){
        var self = this;
        self.status(function(data) {
            cb && cb(data, data.indexOf("nothing to commit") != -1, self.discoverBranch(data));
        });
    };

    this.discoverBranch = function(statusDataFull){
        var self = this;
        var search = "On branch ";
        var branch = undefined;
        var split = statusDataFull.split("\n") || [""];
        var statusData = "";
        self.isDetached = false;

        for(var i=0; i<split.length; i++){
            statusData = split[i];
            if(statusData.indexOf(search) != -1){
                branch = statusData.replace(search, "").trim();
                break;
            }
        }
        if(!branch){
            search = "HEAD detached at"
            for(var i=0; i<split.length; i++){
                statusData = split[i];
                var indexFound = statusData.indexOf(search);
                if(indexFound != -1){
                    branch = statusData.substring(indexFound).trim();
                    branch = statusData.replace(search, "").trim();
                    self.isDetached = true;
                    break;
                }
            }
        }
        return branch;
    };

    this.git = function(cmdArgs, cb) {
        this.runner.run("git", cmdArgs, cb);
    };

    this.gitInherit = function(cmdArgs, cb) {
        this.runner.runInherit("git", cmdArgs, cb);
    };
    //
    this.nerver.init(this);

    NIT.startNerver = function(arg) {
        NIT.nerver.start(arg);
    };
}

function Runner() {
	this.isWin = /^win/.test(process.platform);
    this.child_process = require('child_process');
    this.runInherit = function(cmd, cmdArgs, cb) {

		if(this.isWin){
			if(cmd === "open"){
				cmd = "start";
			}
		}
        var msg = cmd;
        if(cmdArgs){
            for(var i=0; i<cmdArgs.length; i++) {
                msg += " "+cmdArgs[i];
            }
        }
        var spawn = this.child_process.spawn;
        spawn(cmd, cmdArgs, {stdio : 'inherit'});

        cb && cb();
    };

    this.run = function(cmd, cmdArgs, cb) {
		if(this.isWin){
			if(cmd === "open"){
				cmd = "start";
			}
		}
        var spawn = require('child_process').spawn,
        ls = spawn(cmd, cmdArgs);
        // console.log("RUNNING ", "[", cmd,  cmdArgs.join(" "), "]");
        var out = "";
        var error = false;
        ls.stdout.on('data', function (data) {
            out += "\n" + (data ? data.toString() : "");
        });
        ls.stderr.on('data', function (data) {
            error = true;
            out += "\n" + (data ? data.toString() : "");
        });

        ls.on('close', function (code) {
            cb && cb(out, error);
        });
    };


}
