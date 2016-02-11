var app = angular.module('myApp', ['ngSanitize']);

var GLOBAL = {};

function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function formatDate(date){
    var df = (date.getMonth() + 1) + "/" + date.getDate() + "/" + date.getFullYear()
       + "  "+pad(date.getHours(), 2) + ":" + pad(date.getMinutes(), 2);
    return df;
}

app.factory('socket', function ($rootScope) {
    var socket = io.connect();
    return {
        on: function (eventName, callback) {
            socket.on(eventName, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    callback.apply(socket, args);
                });
            });
        },
        emit: function (eventName, data, callback) {
            socket.emit(eventName, data, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    if (callback) {
                        callback.apply(socket, args);
                    }
                });
            });
        }
    };
});

app.controller('socketController', ['$scope', '$http', 'socket', function($scope, $http, socket) {
    $scope.connected = false;
    $scope.isLoggedIn = false;

    $scope.loggedInStatus = function(){
        return $scope.isLoggedIn === true ? "Signed In" : "Signed Out";
    };

    socket.on('connected', function (data) {
        console.log('connected!!', data);
        $scope.connected = true;
        $scope.isLoggedIn = data.isLoggedIn;
        console.log($scope.loggedInStatus());
        socket.projectKey = data.projectKey;
    });

}]);

app.controller('statusController', ['$scope', 'socket',
                                                function($scope, socket) {
    $scope.users = [];
    $scope.cards = [];

    $scope.findUserIndex = function(gitUser) {
        for(var i=0; i<$scope.users.length; i++){
            if($scope.users[i].email==gitUser.email){
                return i;
            }
        }
        return -1;
    };

    $scope.findCardIndex = function(issueKey) {
        for(var i=0; i<$scope.cards.length; i++){
            if($scope.cards[i].key==issueKey){
                return i;
            }
        }
        return -1;
    };

    socket.on('server_cache', function (response) {
        $scope.cards = response.cards;
        $scope.users = response.users;
    });

    $scope.addAuthorToCard = function(cardIndex, gitUser) {
        if(!$scope.cards[cardIndex].authors) {
            $scope.cards[cardIndex].authors = [];
        }
        var authors = $scope.cards[cardIndex].authors;
        for(var i=0; i<authors.length; i++) {
            if(authors[i].email == gitUser.email){
                return;
            }
        }
        $scope.cards[cardIndex].authors.push(gitUser);
    };
}]);

app.controller('pocController', ['$scope', 'socket',
                                                function($scope, socket) {
    socket.on('update_one_line_log_data', function (response) {
        //console.log(response);
    });

    socket.on('update_diff', function (response) {
        //console.log(response);
    });

    socket.on('update_pending', function (response) {
        //console.log(response);
    });

}]);


