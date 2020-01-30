const { ArrBuffer, Observer, GameState, Buffer } = require("../shared/Game");
const io = require("socket.io");

class Room {
    serverInterval = 0;
    gs/*: Game.GameState*/ = new GameState(true);
    start() {
        this.serverInterval = setInterval(() => {
            this.gs.gameLoop();
        }, refreshTime);
    }
    stop() {
        clearInterval(this.serverInterval);
    }
    countOfPlayers()/*: number*/ {
        return this.gs.server.observers.length;
    }

    inBuffer = new ArrBuffer([]);
    join(socket) {
        var inBuffer = this.inBuffer;
        var gs = this.gs;
        var observer = new Observer();
        observer.sessionInSocket++;
        gs.server.addObserver(observer);
        socket.on('orders', function (bufArr) {
            inBuffer.source = bufArr;
            observer.decode(inBuffer);
        }).on('disconnect', function () {
            players--;
        });
        observer.sendBuf = (buf/*: Game.Buffer*/) => {
            if (socket.disconnected) {
                return false;
            }
            socket.emit('game', /*Game.ArrBuffer*/buf.source);
            return true;
        };
    }
}

var refreshTime = 333;
var rooms/*: Room[]*/ = [];
var players = 0;

export function startWsServer(server) {
    var websocket = io.listen(server, {log: false, transports: ['websocket']});

    websocket.sockets.on('connection', function (socket) {
        players++;
        for (var i = 0; i < rooms.length; i++) {
            if (rooms[i].countOfPlayers() < 4) {
                rooms[i].join(socket);
                return;
            }
        }
        var room = new Room();
        room.start();
        room.join(socket);
        rooms.push(room);
    });

    var pp = 0, pr = 0;

    setInterval(function () {
        var j = 0;
        for (var i = 0; i < rooms.length; i++)
            if (rooms[i].countOfPlayers() != 0) {
                rooms[j++] = rooms[i];
            }
        while (rooms.length > j) {
            rooms.pop().stop();
        }
        if (pp != players || pr != rooms.length) {
            console.log("total players: " + players + " rooms: " + rooms.length);
            pp = players;
            pr = rooms.length;
        }
    }, 1000);
}