export var tile_unbreakable = 0, tile_wall = 1, tile_floor = 2;
export var tile_road = 4;
export var tile_active = 8;
export var tile_exit = tile_road + tile_active + 16;
export var ORDER_TICK = 1, ORDER_KEY = 2, ORDER_BOMB = 3;

export var unit_char = 1, unit_bomb = 2, unit_explosion = 3;

export class State {
    beforeTick()/*void*/ {
    }
    nowTick()/*void*/ {
    }
    afterTick()/*void*/ {
    }
    decodeBoot(buf/*Buffer*/)/*void*/ {
    }
    decode(buf/*Buffer*/)/*void*/ {
    }
    encodeBoot(buf/*Buffer*/)/*void*/ {
    }
    encode(buf/*Buffer*/)/*void*/ {
    }
    hasChanges()/*boolean*/ {
        return false;
    }
}

export class Buffer {
    static MODE_READ = 1;
    static MODE_WRITE = 2;
    mode/*number*/ = 0;
    pop(key = null)/*number*/ {
        return 0;
    }
    push(x/*number*/, key = null)/*void*/ {

    }

    clear()/*void*/ {

    }
}

export class ArrBuffer extends Buffer {

    constructor(source/*number[]*/) {
        super();
        this.source=source;
    }

    pop(key = null)/*number*/ {
        if (this.source.length == 0)
            throw "buffer has no ints";
        if (this.mode != Buffer.MODE_READ)
            throw "buffer is not in read mode";
        if (key) {
            var key2 = this.source.shift();
            if (key2 != key)
                throw "key=" + key + " found=" + key2;
        }
        return this.source.shift();
    }
    push(x/*number*/, key = null) {
        if (key)
            this.source.push(key);
        if (this.mode != Buffer.MODE_WRITE)
            throw "buffer is not in write mode";
        this.source.push(x);
    }

    clear() {
        this.source = [];
    }
}

export class Router {
    // childs: State[];
    beforeTick()/*void*/ {
        for (var i = 0; i < this.childs.length; i++)
            this.childs[i].beforeTick();
    }
    nowTick()/*void*/ {
        for (var i = 0; i < this.childs.length; i++)
            this.childs[i].nowTick();
    }
    afterTick()/*void*/ {
        for (var i = 0; i < this.childs.length; i++) {
            this.childs[i].afterTick();
        }
    }

    getModMask() {
        this.modMask = 0;
        for (var i = 0; i < this.childs.length; i++) {
            if (this.childs[i].hasChanges())
                this.modMask |= (1 << i);
        }
        return this.modMask;
    }

    modMask/*number*/ = 0;
    decodeBoot(buf/*Buffer*/)/*void*/ {
        for (var i = 0; i < this.childs.length; i++) {
            this.childs[i].decodeBoot(buf);
        }
    }
    decode(buf/*Buffer*/)/*void*/ {
        var modMask = buf.pop();
        for (var i = 0; i < this.childs.length; i++) {
            if ((modMask & (1 << i)) != 0)
                this.childs[i].decode(buf);
        }
    }
    encodeBoot(buf/*Buffer*/)/*void*/ {
        for (var i = 0; i < this.childs.length; i++) {
            this.childs[i].encodeBoot(buf);
        }
    }
    encode(buf/*Buffer*/)/*void*/ {
        var modMask = this.getModMask();
        buf.push(modMask);
        for (var i = 0; i < this.childs.length; i++) {
            if ((modMask & (1 << i)) != 0)
                this.childs[i].encode(buf);
        }
    }
    hasChanges()/*boolean*/ {
        return this.getModMask() != 0;
    }
}

export class Unit extends State {
    static BIT_CONSTANT = 1;
    static BIT_POS = 2;
    static BIT_KEY = 4;
    static BIT_COOLDOWN = 8;

    view/*UnitView*/ = null;
    id/*number*/ = 0;
    index/*number*/ = 0;
    type/*number*/ = 0;
    gs/*GameState*/ = null;

    x/*number*/;
    y/*number*/;
    player/*number*/ = 0;

    joinGameState(gs)/*void*/ {
        this.gs = gs;
    }

    leaveGameState()/*void*/ {
        var gs2 = this.gs;
        this.gs = null;
        gs2.units.remove(this);
    }

    inGame()/*boolean*/ {
        return this.gs != null;
    }

    load(buf/*Buffer*/, modified) {
        this.modified = modified;
        if ((modified & Unit.BIT_CONSTANT) != 0) {
            this.id = buf.pop();
            this.player = buf.pop();
        }
        if ((modified & Unit.BIT_POS) != 0) {
            var p = buf.pop();
            this.x = p & 255;
            this.y = p >> 8;
        }
    }

    save(buf/*Buffer*/, modified) {
        if ((modified & Unit.BIT_CONSTANT) != 0) {
            buf.push(this.id);
            buf.push(this.player);
        }
        if ((modified & Unit.BIT_POS) != 0) {
            buf.push(this.x | (this.y << 8));
        }
    }

    beforeTick() {
        this.modified = 0;
    }

    modified/*number*/ = 0;

    decodeBoot(buf/*Buffer*/)/*void*/ {
        this.load(buf, -1);
    }
    decode(buf/*Buffer*/)/*void*/ {
        this.load(buf, buf.pop());
    }
    encodeBoot(buf/*Buffer*/)/*void*/ {
        this.save(buf, -1);
    }
    encode(buf/*Buffer*/)/*void*/ {
        buf.push(this.modified);
        this.save(buf, this.modified);
    }

    hasChanges()/*boolean*/ {
        return this.modified != 0;
    }
}

export class Units extends State {
    constructor(gs/*GameState*/) {
        super();
        this.gs = gs;
        gs.childs.push(this);
    }

    byId/*Unit[]*/ = [];
    list/*Unit[]*/ = [];
    prevListSize/*number*/ = 0;
    counterId/*number*/ = 1;
    characterByPlayerId/*Character[]*/ = [null, null, null, null, null];

    createByUid(uid/*number*/)/*Unit*/ {
        if (uid == unit_char) return new Character();
        if (uid == unit_bomb) return new Bomb();
        if (uid == unit_explosion) return new Explosion();
        return null;
    }

    add(unit/*Unit*/)/*void*/ {
        unit.id = this.counterId++;
        this.byId[unit.id] = unit;
        this.list.push(unit);
        unit.index = this.list.length - 1;
        unit.joinGameState(this.gs);
        if (unit.type == unit_char)
            this.characterByPlayerId[unit.player] = /*Character*/unit;
    }

    remove(unit/*Unit*/)/*void*/ {
        if (unit.inGame())
            unit.leaveGameState()
        else {
            if (unit.type == unit_char)
                this.characterByPlayerId[unit.player] = null;
            this.list[unit.index] = null;
        }
    }

    beforeTick()/*void*/ {
        for (var i = 0; i < this.list.length; i++)
            if (this.list[i])
                this.list[i].beforeTick();
    }

    nowTick()/*void*/ {
        for (var i = 0; i < this.list.length; i++)
            if (this.list[i])
                this.list[i].nowTick();
    }

    afterTick()/*void*/ {
        for (var i = 0; i < this.list.length; i++) {
            if (this.list[i])
                this.list[i].afterTick();
        }

        var j = 0;
        for (var i = 0; i < this.list.length; i++)
            if (this.list[i] == null) {
            } else {
                this.list[j] = this.list[i];
                this.list[j].index = j;
                j++;
            }
        while (this.list.length > j)
            this.list.pop();
        this.prevListSize = this.list.length;
    }

    decodeBoot(buf/*Buffer*/)/*void*/ {
        var sz = buf.pop();
        for (var i = 0; i < sz; i++) {
            var type = buf.pop();
            var unit = this.createByUid(type);
            unit.decodeBoot(buf);
            this.add(unit);
        }
    }

    decode(buf/*Buffer*/)/*void*/ {
        var num = (this.list.length + 31) / 32 | 0;
        var masks = [];
        for (var i = 0; i < num; i++)
            masks.push(buf.pop());
        var prevListSize = this.list.length;
        for (var i = 0; i < prevListSize; i++)
            if ((masks[i >> 5] & (1 << (i & 31))) != 0) {
                this.remove(this.list[i]);
            }
        for (var i = 0; i < num; i++)
            masks[i] = buf.pop();
        for (var i = 0; i < prevListSize; i++)
            if ((masks[i >> 5] & (1 << (i & 31))) != 0) {
                this.list[i].decode(buf);
            }
        var newSz = buf.pop();
        for (var i = 0; i < newSz; i++) {
            var type = buf.pop("Unit type");
            var unit = this.createByUid(type);
            unit.decodeBoot(buf);
            this.add(unit);
        }
    }
    encodeBoot(buf/*Buffer*/)/*void*/ {
        var sz = 0, len = this.list.length;
        for (var i = 0; i < len; i++)
            if (this.list[i])
                sz++;
        buf.push(sz);
        for (var i = 0; i < len; i++) {
            var unit = this.list[i];
            if (unit) {
                buf.push(unit.type);
                unit.encodeBoot(buf);
            }
        }
    }
    encode(buf/*Buffer*/)/*void*/ {
        var prevListSize = this.prevListSize;
        var num = (prevListSize + 31) / 32 | 0;
        var masks = [];
        for (var i = 0; i < num; i++)
            masks.push(0);
        for (var i = 0; i < prevListSize; i++)
            if (this.list[i] == null)
                masks[i >> 5] |= (1 << (i & 31));
        for (var i = 0; i < num; i++) {
            buf.push(masks[i]);
            masks[i] = 0;
        }
        for (var i = 0; i < prevListSize; i++)
            if (this.list[i] && this.list[i].hasChanges())
                masks[i >> 5] |= (1 << (i & 31));
        for (var i = 0; i < num; i++)
            buf.push(masks[i]);
        for (var i = 0; i < prevListSize; i++)
            if (this.list[i] && this.list[i].hasChanges())
                this.list[i].encode(buf);
        var sz = 0;
        for (var i = prevListSize; i < this.list.length; i++) {
            if (this.list[i])
                sz++;
        }
        buf.push(sz);
        for (var i = prevListSize; i < this.list.length; i++) {
            var unit = this.list[i];
            if (unit) {
                buf.push(unit.type, "Unit type");
                unit.encodeBoot(buf);
            }
        }
    }

    hasChanges()/*boolean*/ {
        if (this.list.length != this.prevListSize)
            return true;
        for (var i = 0; i < this.list.length; i++)
            if (this.list[i] == null || this.list[i].hasChanges())
                return true;
        return false;
    }
}

export class Map extends State {

    static INF = 1 << 29;

    // field/*number*/[] = [];
    // changed/*number*/[] = [];

    constructor(gs/*GameState*/, w/*number*/, h/*number*/) {
        super();
        this.gs = gs;
        this.w=w;
        this.h=h;
        this.field = [];
        this.changed = [];
        gs.childs.push(this);
        for (var i = 0; i < w * h; i++)
            this.field.push(tile_floor);
    }

    isGood(x/*number*/, y/*number*/, team/*number*/)/*boolean*/ {
        var v = this.get(x, y);
        if ((v & tile_exit) == tile_exit) return false;
        return (v&3)==team;
    }

    isBreakable(x/*number*/, y/*number*/, team/*number*/)/*boolean*/ {
        var v = this.get(x, y);
        return ((v & tile_exit) != tile_exit &&
                (v & 3) == 3 - team);
    }

    doBreak(x/*number*/, y/*number*/, team/*number*/) {
        var v = this.get(x, y);
        if ((v & tile_exit) != tile_exit &&
                (v & 3) == 3 - team) {
            if ((v & tile_road) != 0) {
                if ((v & tile_active) != 0) {
                    v ^= tile_active;
                    var w = this.ways[3 - team];
                    var j = w.length;
                    for (var i = 0; i < w.length; i++) {
                        if (w[i].x == x && w[i].y == y)
                            j = i;
                        if (i >= j)
                            this.set(w[i].x, w[i].y, this.get(w[i].x, w[i].y) ^ tile_active);
                    }
                    while (w.length > j && w.length>1) {
                        w.pop();
                    }
                } else v ^= tile_road;
            }
            else v ^= 3;
            this.set(x, y, v);
        }
    }

    ways = [[], [], []];
    
    doActivate(x/*number*/, y/*number*/, team/*number*/) {
        var act = tile_active + tile_road + team;
        if (this.get(x, y) == act)
            return;
        var pas = tile_road + team;
        var w = this.ways[team];
        if (w[0].x == x && w[0].y == y) {
            this.doActivateWay(x, y, 0, 1, team);
            return;
        } else if (this.get(w[0].x, w[0].y) != act)
            return;
        for (var i = 0; i < w.length; i++) {
            if (Math.abs(w[i].x - x) + Math.abs(w[i].y - y) == 1) {
                for (var j = i + 1; j < w.length; j++)
                    this.set(w[j].x, w[j].y, pas);
                while (w.length > i+1)
                    w.pop();
                this.doActivateWay(x, y, x - w[i].x, y - w[i].y, team);
                break;
            }
        }
    }

    doActivateWay(x/*number*/, y/*number*/, dx/*number*/, dy/*number*/, team/*number*/) {
        var w = this.ways[team];
        var act = tile_active + tile_road + team;
        var pas = tile_road + team;
        while (true) {
            this.set(x, y, act);
            if (w[0].x != x || w[0].y != y) {
                w.push({ x: x, y: y });
            }
            if (this.get(x, y - 1) == tile_exit + 3 - team) {
                this.gs.server.teamWin(team);
                break;
            }
            if (this.get(x + dx, y + dy) == pas) {
                x += dx;
                y += dy;
            } else
                if (this.get(x + dy, y - dx) == pas) {
                    x += dy;
                    y -= dx;
                    var t = dx; dx = dy; dy = -t;
                } else
                    if (this.get(x - dy, y + dx) == pas) {
                        x -= dy;
                        y += dx;
                        var t = dx; dx = -dy; dy = t;
                    } else break;
        }
        var l1 = this.get(x - dy, y + dx);
    }

    exit = [{x:0, y:0}, {x:3, y:3}, {x:7, y:7}];

    generate()/*void*/ {
        for (var x = 0; x < this.w; x++) {
            for (var y = 0; y < this.h; y++) {
                this.set(x, y, tile_floor);
            }
        }
        var midW = this.w / 2 | 0;
        var midH = this.h / 2 | 0;
        var p1 = this.wrap(this.rnd(midW), this.rnd(midH));
        var p2;
        var iters = 100;
        var cur = 0;
        while (cur < iters) {
            p2 = this.wrap(midW + this.rnd(midW), midH + this.rnd(midH-1));
            var d1 = this.way(p1.x, p1.y, p2.x, p2.y, [p1, p2]);
            if (d1 < Map.INF && d1 > 4) {
                break;
            }
            var d2 = this.way(p2.x, p2.y, p1.x, p1.y, [p1, p2]);
            if (d2 < Map.INF && d2 > 4) {
                break;
            }
            ++cur;
        }

        var cnt = this.w * this.h * 0.1 | 0;
        var closed = cnt;
        while (cnt > 0) {
            var p = this.wrap(this.rnd(this.w), this.rnd(this.h));
            var prev = this.get(p.x, p.y);
            this.set(p.x, p.y, tile_unbreakable);
            var free = this.getFree();
            var d1 = this.way(p1.x, p1.y, p2.x, p2.y, [p1, p2]);
            var d2 = this.way(p2.x, p2.y, p1.x, p1.y, [p1, p2]);
            var d3 = this.way(free.x, free.y, p1.x, p1.y, [p1, p2]);
            if (d1 == Map.INF || d2 == Map.INF || d3 == Map.INF) {
                this.set(p.x, p.y, prev);
                --closed;
            }
            --cnt;
        }
        var walls = (this.w * this.h - closed) * 0.5 | 0;
        while (walls > 0) {
            var p = this.wrap(this.rnd(this.w), this.rnd(this.h));
            if (this.get(p.x, p.y) == tile_floor) {
                this.set(p.x, p.y, tile_wall);
                --walls;
            }
        }

        this.ways = [[], [], []];
        this.exit = [{}, p1, p2];
        for (var k = 1; k <= 2; k++) {
            this.set(this.exit[k].x, this.exit[k].y, (tile_exit | k));
            this.set(this.exit[k].x, this.exit[k].y + 1, (tile_road | tile_active | k));
            this.ways[k].push({ x: this.exit[k].x, y: this.exit[k].y + 1 });
        }
    }

    getFree() {
        for (var i = 0; i < this.w; ++i)
            for (var j = 0; j < this.h; ++j)
                if (this.get(i, j) == tile_floor) {
                    return {x: i, y: j};
                }
        return {x: 0, y: 0};
    }
    
    way(x1, y1, x2, y2, closed)/*number*/ {
        var queue = [];
        queue.push(this.wrap(x1, y1));
        var d = new Array(this.w);
        for (var i = 0; i < this.w; ++i) {
            d[i] = new Array(this.h);
            for (var j = 0; j < this.h; ++j) 
                d[i][j] = Map.INF;
        }
        d[x1][y1] = 0;
        var dx = [0, 1, 0, -1];
        var dy = [1, 0, -1, 0];
        while (queue.length > 0) {
            var el = queue.shift();
            var x = el.x, y = el.y;
            for (var i = 0; i < 4; ++i) {
                var nx = x + dx[i];
                var ny = y + dy[i];
                if (nx >= 0 && nx < this.w && ny >= 0 && ny < this.h && d[nx][ny] > d[x][y] + 1 && this.get(nx, ny) != tile_unbreakable) {
                    d[nx][ny] = d[x][y] + 1;
                    var move/*boolean*/ = true;
                    for (var el in closed) {
                        if (closed[el].x == nx && closed[el].y == ny) {
                            move = false;
                            break;
                        }
                    }
                    if (move) {
                        queue.push(this.wrap(nx, ny));
                    }
                } 
            }    
        }
        for (var i = 0; i < this.w; ++i) {
            for (var j = 0; j < this.h; ++j) {
                if (this.get(i, j) != tile_unbreakable) {
                    if (d[i][j] == Map.INF)
                        return Map.INF;
                }
            }
        }    
        return d[x2][y2];
    }
    
    wrap(x, y) {
        return {x: x, y: y};
    }

    rnd(size)/*number*/ {
        return Math.floor((Math.random() * size));
    }

    beforeTick() {
        if (this.changed.length > 0)
            this.changed = [];
    }

    get (x/*number*/, y/*number*/)/*number*/ {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h)
            return tile_unbreakable;
        return this.field[x + y * this.w];
    }

    set (x/*number*/, y/*number*/, value/*number*/) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h)
            return;
        var ind = x + y * this.w;
        var v = this.field[ind];
        if (v != value) {
            this.field[ind] = value;
            this.changed.push(ind);
        }
    }

    encodeBoot(buf/*Buffer*/)/*void*/ {
        for (var i = 0; i < this.field.length; i++)
            buf.push(this.field[i]);
    }
    encode(buf/*Buffer*/)/*void*/ {
        var sz = this.changed.length;
        buf.push(sz);
        for (var i = 0; i < sz; i++) {
            var x = this.changed[i];
            buf.push(x);
            buf.push(this.field[x]);
        }
    }
    decode(buf/*Buffer*/)/*void*/ {
        var sz = buf.pop();
        for (var i = 0; i < sz; i++) {
            var x = buf.pop();
            var val = buf.pop();
            this.field[x] = val;
            this.changed.push(x);
        }
    }
    decodeBoot(buf/*Buffer*/)/*void*/ {
        for (var i = 0; i < this.field.length; i++) {
            this.field[i] = buf.pop();
        }
        for (var i = 0; i < this.field.length; i++)
            if ((this.field[i] & ~3) == tile_exit) {
                this.exit[this.field[i] & 3] = {x: i%this.w, y: i/this.w};
            }
    }


    hasChanges()/*boolean*/ {
        return this.changed.length > 0;
    }

    findFreePlace() {
        return { x: 1, y: 1 };
    }
}

export class GameState extends Router {
    // server: GameServer = null;
    // client: GameClient = null;
    // childs: State[] = [];
    // units/*Unit*/;
    // map/*: Map;

    tick = 0;
    win = 0;
    unixTime = 0;
    uid = 0;

    inputBuf/*Buffer*/;

    constructor(isServer/*boolean*/) {
        super();
        this.server = null;
        this.client = null;
        this.childs = [];

        this.map = new Map(this, 13, 9);
        if (isServer)
            this.map.generate();
        this.units = new Units(this);
        if (isServer)
            this.server = new GameServer(this);
        else this.client = new GameClient(this);
    }

    gameLoop() {
        this.beforeTick();
        this.nowTick();
        this.tick++;
        if (this.client)
            this.decode(this.inputBuf);
        if (this.server)
            this.server.encodeAll();
        this.afterTick();
    }
}

export class Observer {
    playerId/*number*/ = 0;
    gs/*GameState*/;
    sessionInGame/*number*/ = 0;
    sessionInSocket/*number*/ = 1;
    gameUid/*number*/ = 0;
    wantToBeObs/*boolean*/ = false;
    active/*number*/ = 0;

    orders/*: Order[]*/ = [];

    sendBuf(buf/*Buffer*/)/*boolean*/ {
        return false;
    }

    decode(buf/*Buffer*/) {
        if (!this.gs) return;
        buf.mode = Buffer.MODE_READ;
        try {
            var sz = buf.pop();
            var gid = buf.pop();
            if (gid != this.gs.uid) return;
            for (var i = 0; i < sz; i++) {
                var order = this.gs.server.createOrderById(buf.pop());
                order.load(buf);
                this.orders.push(order);
            }
        } catch (e) {
            console.log(e);
        }
    }
}


export var CODE_NEW_GAME = 1, CODE_DIFF = 2;

export class GameServer extends State {
    constructor(gs/*GameState*/) {
        super();
        this.gs = gs;
        gs.childs.splice(0, 0, this);
    }

    observers/*: Observer[]*/ = [];
    obsById/*: Observer[]*/ = [null, null, null, null, null];

    static END_TIME = 18;

    orders/*: Order[]*/ = [];
    endCount/*number*/ = 0;

    beforeTick() {
        while (this.orders.length > 0)
            this.orders.pop();
        for (var i = 0; i < this.observers.length; i++) {
            var obs = this.observers[i];
            if (obs.orders.length > 0) {
                for (var j = 0; j < obs.orders.length; j++) {
                    var order = obs.orders[j];
                    if (order && obs.playerId) {
                        order.player = obs.playerId;
                        this.orders.push(obs.orders[j]);
                    }
                }
                while (obs.orders.length > 0)
                    obs.orders.pop();
            }
        }
    }

    teamWin(team/*number*/) {
        if (this.gs.win == 0) {
            this.gs.win = team;
        }
    }

    resetLevel() {
        this.gs.tick = 0;
        this.gs.win = 0;
        this.endCount = 0;
        this.gs.uid++;
        this.gs.map.generate();
        var list = this.gs.units.list;
        for (var i = 0; i < list.length; i++)
            if (list[i])
                list[i].leaveGameState();
    }

    nowTick() {
        for (var i = 0; i < this.orders.length; i++) {
            this.orders[i].execute(this.gs);
        }
        this.gs.unixTime = Date.now() / 1000 | 0;
        if (this.gs.win != 0) {
            this.endCount++;
            if (this.endCount >= GameServer.END_TIME) {
                this.resetLevel();
            }
        }

        var j = 0;
        var left = [];
        for (var i = 0; i < this.observers.length; i++) {
            var obs = this.observers[i];
            if (obs.active < 5) {
                this.observers[j++] = obs;
            } else {
                left.push(obs);
                if (obs.playerId > 0) {
                    this.obsById[obs.playerId] = null;
                    var char = this.gs.units.characterByPlayerId[obs.playerId];
                    if (char)
                        char.leaveGameState();
                }
                obs.gs = null;
            }
        }
        while (this.observers.length > j)
            this.observers.pop();
        if (left.length > 0) {
            for (var i = 0; i < this.observers.length; i++) {
                var obs = this.observers[i];
                this.tryAssignPlayerId(obs);
            }
        }
        this.doRespawn();
    }

    respawnCoolDown = [0, 0, 0, 0, 0];

    doRespawn() {
        for (var i = 0; i < this.observers.length; i++) {
            var obs = this.observers[i];
            if (!obs.playerId) continue;
            var char = this.gs.units.characterByPlayerId[obs.playerId];
            if (!char) {
                if (this.respawnCoolDown[obs.playerId] == 0) {
                    var c = new Character();
                    c.player = obs.playerId;
                    c.team = 1;
                    var pos = this.generatePos(obs.playerId <= 2 ? 1 : 2);
                    c.x = pos.x;
                    c.y = pos.y
                    this.gs.units.add(c);
                } else this.respawnCoolDown[obs.playerId]--;
            }
        }
    }

    generatePos(player) {
        var p;
        var iters = 50;
        var w = this.gs.map.w / 2 | 0;
        var h = this.gs.map.h / 2 | 0;
        while (iters > 0) {
            p = this.gs.map.wrap(this.gs.map.rnd(w+1), this.gs.map.rnd(h+1));
            if (player == 2) {
                p.x += w;
                p.y += h;
            }
            p.x = Math.min(this.gs.map.w - 1, p.x);
            p.y = Math.min(this.gs.map.h - 1, p.y);
            if (this.gs.map.get(p.x, p.y) == player) 
                break;
            --iters;
        }
        return p;
    }

    createOrderById(id/*number*/)/*: Order*/ {
        if (id == ORDER_KEY)
            return new KeyOrder();
        if (id == ORDER_TICK)
            return new TickOrder();
        if (id == ORDER_BOMB)
            return new BombOrder();
        return null;
    }

    outBuf/*Buffer*/ = new ArrBuffer([]);

    encodeAll() {
        var outBuf = this.outBuf;
        for (var i = 0; i < this.observers.length; i++) {
            var obs = this.observers[i];
            outBuf.clear();
            outBuf.mode = Buffer.MODE_WRITE;
            if (obs.gameUid != this.gs.uid ||
                obs.sessionInGame != obs.sessionInSocket) {
                obs.gameUid = this.gs.uid;
                obs.sessionInGame = obs.sessionInSocket;
                outBuf.push(CODE_NEW_GAME);
                outBuf.push(obs.gameUid);
                outBuf.push(obs.playerId);
                outBuf.push(this.gs.tick);
               // outBuf.push(this.gs.unixTime);
                this.gs.encodeBoot(outBuf);
            } else {
                outBuf.push(CODE_DIFF);
                outBuf.push(obs.gameUid);
                outBuf.push(this.respawnCoolDown[obs.playerId]);
                outBuf.push(this.gs.win);
               // outBuf.push(this.gs.unixTime);
                this.gs.encode(outBuf);
            }
            if (obs.sendBuf(outBuf))
                obs.active = 0;
            else obs.active++;
        }
    }

    addObserver(obs/*Observer*/) {
        this.observers.push(obs);
        obs.gs = this.gs;
        this.tryAssignPlayerId(obs);
    }

    static joinOrder = [0, 1, 3, 2, 4];

    tryAssignPlayerId(obs/*Observer*/) {
        if (obs.playerId != 0 || obs.wantToBeObs) {
            return;
        }
        for (var j = 1; j <= 4; j++) {
            var i = GameServer.joinOrder[j];
            if (this.obsById[i] == null) {
                obs.playerId = i;
                this.obsById[i] = obs;
                obs.gameUid = 0;
                return;
            }
        }
    }
}

export class KeyController extends State {
    constructor(gs/*GameState*/) {
        super();
        this.gs = gs;
        gs.childs.push(this);
    }


    keysReset/*boolean*/ = false;
    wasKeys/*boolean*/ = false;
    go/*number*/ = 0;
    go2/*number*/ = 0;
    setupBomb/*boolean*/ = false;

    setKeys(side) {
        this.go2 = side;
    }

    bomb() {
        this.setupBomb = true;
    }

    keyTick() {
        var char = this.gs.client.mainCharacter;
        if (char) {
            if (this.go2 != this.go) {
                var t = new KeyOrder();
                t.key = this.go2;
                this.go = this.go2;
                this.gs.client.orders.push(t);
            }
            if (this.setupBomb) {
                this.setupBomb = false;
                var t2 = new BombOrder();
                this.gs.client.orders.push(t2);
            }
            if (this.gs.client.orders.length > 0)
                this.gs.client.sendOrders();
        }
    }
}

export class Order {
    player/*number*/ = 0;
    type/*number*/ = 0;

    save(buf/*Buffer*/) {
    }

    load(buf/*Buffer*/) {
    }

    execute(gs/*GameState*/) {
    }
}

export class TickOrder extends Order {
    constructor() {
        super();
        this.type = ORDER_TICK;
    }
    tick = 0;

    save(buf/*Buffer*/) {
        buf.push(this.tick);
    }

    load(buf/*Buffer*/) {
        this.tick = buf.pop();
    }
}

export class KeyOrder extends Order {
    constructor() {
        super();
        this.type = ORDER_KEY;
    }

    key/*number*/ = 0;

    save(buf/*Buffer*/) {
        buf.push(this.key);
    }

    load(buf/*Buffer*/) {
        this.key = buf.pop();
    }

    execute(gs/*GameState*/) {
        var char = gs.units.characterByPlayerId[this.player];
        if (char) {
            char.inputKey(this.key);
        }
    }
}

export class BombOrder extends Order {
    constructor() {
        super();
        this.type = ORDER_BOMB;
    }

    execute(gs/*GameState*/) {
        var char = gs.units.characterByPlayerId[this.player];
        if (char) {
            char.placeBomb();
        }
    }
}

export class GameClient extends State {
    constructor(gs/*GameState*/) {
        super();
        this.gs = gs;
        gs.childs.splice(0, 0, this);
        this.key = new KeyController(gs);
    }

    respawnCoolDown = 0;
    // key: KeyController;
    mainCharacter/*Character*/ = null;
    views /*UnitView[]*/ = [];
    outBuf = new ArrBuffer([]);
    playerId/*number*/;

    createView(unit/*Unit*/)/*UnitView*/ {
        return null;
    }

    decodeBoot(buf/*Buffer*/) {
        this.gs.uid = buf.pop();
        this.playerId = buf.pop();
       // this.gs.unixTime = buf.pop();
        this.gs.tick = buf.pop();
    }

    decode(buf/*Buffer*/) {
    }

    nowTick() {
        var list = this.gs.units.list;
        this.mainCharacter = null;
        for (var i = 0; i < list.length; i++)
            if (list[i] && list[i].type == unit_char && list[i].player == this.playerId)
                this.mainCharacter = /*Character*/list[i];
    }

    afterTick() {
        var list = this.gs.units.list;
        for (var i = 0; i < list.length; i++)
            if (list[i] && list[i].view == null) {
                var view = this.createView(list[i]);
                if (view != null) {
                    list[i].view = view;
                    this.views[list[i].id] = view;
                }
            }
        for (var id in this.views)
            if (!this.views[id].unit.inGame())
                delete this.views[id];
            else this.views[id].updateTick();
        var t = new TickOrder();
        t.tick = this.gs.tick;
        this.orders.push(t);
        this.sendOrders();
    }

    orders = [];
    sendOrders() {
        var outBuf = this.outBuf;
        outBuf.clear();
        outBuf.mode = Buffer.MODE_WRITE;
        var orders = this.orders;
        var sz = orders.length;
        outBuf.push(sz);
        outBuf.push(this.gs.uid);
        for (var i = 0; i < sz; i++) {
            outBuf.push(orders[i].type);
            orders[i].save(outBuf);
        }
        this.sendIt(outBuf);
        while (orders.length > 0)
            orders.pop();
    }

    sendIt(buf/*Buffer*/) {
    }
}

export class Character extends Unit {
    static KEY_RIGHT = 1;
    static KEY_DOWN = 2;
    static KEY_LEFT = 3;
    static KEY_UP = 4;
    static dx = [0, 1, 0, -1, 0];
    static dy = [0, 0, 1, 0, -1];
    static BOMB_COOLDOWN = 12;
    static RESPAWN_COOLDOWN = 12;
    static HP_DEF = 3;
    static HP_START = 9;

    team/*number*/ = 0;
    keys/*number*/ = 0;
    bombsCount/*number*/ = 2;
    hp/*number*/ = Character.HP_START;
    bombCoolDown = [0, 0];
    setupBomb/*boolean*/ = false;

    constructor() {
        super();
        this.type = unit_char;
    }

    inputKey(key/*number*/) {
        if (key != this.keys) {
            this.modified |= Unit.BIT_KEY;
            this.keys = key;
        }
    }

    getBombsPlaced() {
        var cnt = 0;
        if (this.bombCoolDown[0])
            cnt++;
        if (this.bombCoolDown[1])
            cnt++;
        return cnt;
    }

    placeBomb() {
        if (this.getBombsPlaced() >= this.bombsCount)
            return;
        var list = this.gs.units.list;
        for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].type == unit_bomb && list[i].x == this.x && list[i].y == this.y)
                return;
        }

        var bomb = new Bomb(this.x, this.y, this.team);
        if (!this.bombCoolDown[0])
            this.bombCoolDown[0] = Character.BOMB_COOLDOWN;
        else
            this.bombCoolDown[1] = Character.BOMB_COOLDOWN;
        this.gs.units.add(bomb);
        this.modified |= Unit.BIT_COOLDOWN;
    }

    isAlive()/*boolean*/ {
        return this.hp >= Character.HP_DEF;
    }

    nowTick()/*void*/ {
        this.team = this.player <= 2 ? 1 : 2;
        if (this.hp == 0) {
            if (this.gs.server) {
                this.gs.server.respawnCoolDown[this.player] = Character.RESPAWN_COOLDOWN;
                this.leaveGameState();
            }
            return;
        } else
        if (this.hp != Character.HP_DEF) {
            this.hp--;
        }
        else {
            if (this.gs.server) {
                if (!this.gs.map.isGood(this.x, this.y, this.team)) {
                    this.hp--;
                    this.modified |= Unit.BIT_COOLDOWN;
                }
            }
        }
        if (this.bombCoolDown[0] > 0)
            this.bombCoolDown[0]--;
        if (this.bombCoolDown[1] > 0)
            this.bombCoolDown[1]--;
        if (!this.gs.server || !this.isAlive()) return;
        if (this.keys != 0) {
            var x1 = this.x + Character.dx[this.keys];
            var y1 = this.y + Character.dy[this.keys];
            if (this.gs.map.isGood(x1, y1, this.team)) {
                this.x = x1;
                this.y = y1;
                this.modified |= Unit.BIT_POS;
            }
        }
    }

    load(buf/*Buffer*/, modified/*number*/) {
        super.load(buf, modified);
        if ((modified & Unit.BIT_KEY) != 0)
            this.keys = buf.pop();
        if ((modified & Unit.BIT_COOLDOWN) != 0) {
            this.bombCoolDown[0] = buf.pop();
            this.bombCoolDown[1] = buf.pop();
            this.hp = buf.pop();
        }
    }

    save(buf/*Buffer*/, modified/*number*/) {
        super.save(buf, modified);
        if ((modified & Unit.BIT_KEY) != 0)
            buf.push(this.keys);
        if ((modified & Unit.BIT_COOLDOWN) != 0) {
            buf.push(this.bombCoolDown[0]);
            buf.push(this.bombCoolDown[1]);
            buf.push(this.hp);
        }
    }
}

export class Bomb extends Unit {

    static DEFAULT_BOMB_TICKS = 5;

    leftTicks/*number*/;
    team/*number*/ = 0;

    constructor(x = 0, y = 0, team = 0) {
        super();
        this.x = x;
        this.y = y;
        this.team = team;
        this.type = unit_bomb;
        this.leftTicks = Bomb.DEFAULT_BOMB_TICKS;
    }

    nowTick()/*void*/ {
        --this.leftTicks;
        if (this.gs.server && this.leftTicks <= 0) {
            this.explode();
        }
    }

    explode()/*void*/ {
        var cells = this.cellsToExplode(Explosion.DEFAULT_POWER);
        this.gs.units.add(new Explosion(this.x, this.y, this.team, cells, Explosion.DEFAULT_POWER));
        this.gs.units.remove(this);
    }

    cellsToExplode(power) {
        var map = this.gs.map;
        var srv = this.gs.server;
        if (map.isBreakable(this.x, this.y, this.team)) {
            srv && map.doBreak(this.x, this.y, this.team);
            return { up: 0, down: 0, left: 0, right: 0};
        }
        map.doActivate(this.x, this.y, this.team);
        // up
        var up = power, down = power, right = power, left = power;
        for (var i = 1; i <= power; ++i) {
            var x = this.x, y = this.y - i;
            if (!map.isGood(x, y, this.team)) {
                up = i-1;
                if (srv && map.isBreakable(x, y, this.team)) {
                    up = i;
                    map.doBreak(x, y, this.team);
                }
                break;
            }
        }
        // down
        for (var i = 1; i <= power; ++i) {
            var x = this.x, y = this.y + i;
            if (!map.isGood(x, y, this.team)) {
                down = i - 1;
                if (srv && map.isBreakable(x, y, this.team)) {
                    down = i;
                    map.doBreak(x, y, this.team);
                }
                break;
            }
        }
        // left
        for (var i = 1; i <= power; ++i) {
            var x = this.x - i, y = this.y;
            if (!map.isGood(x, y, this.team)) {
                left = i - 1;
                if (srv && map.isBreakable(x, y, this.team)) {
                    left = i;
                    map.doBreak(x, y, this.team);
                }
                break;
            }
        }
        // right
        for (var i = 1; i <= power; ++i) {
            var x = this.x + i, y = this.y;
            if (!map.isGood(x, y, this.team)) {
                right = i - 1;
                if (srv && map.isBreakable(x, y, this.team)) {
                    right = i;
                    map.doBreak(x, y, this.team);
                }
                break;
            }
        }
        return {up: up, down: down, left: left, right: right};

    }


    load(buf/*Buffer*/, modified/*number*/) {
        super.load(buf, modified);
        if ((modified & Unit.BIT_CONSTANT) != 0)
            this.team = buf.pop();
    }

    save(buf/*Buffer*/, modified/*number*/) {
        super.save(buf, modified);
        if ((modified & Unit.BIT_CONSTANT) != 0)
            buf.push(this.team);
    }
}

export class Explosion extends Unit {

    static DEFAULT_POWER = 2;

    team/*number*/;
    power/*number*/ = 2;
    remove/*boolean*/ = false;
    up/*number*/;
    down/*number*/;
    right/*number*/;
    left/*number*/;

    constructor(x/*number*/ = 0, y/*number*/ = 0, team/*number*/ = 0, cells = {up: 0, down: 0, right: 0, left: 0}, power = 0) {
        super();
        this.type = unit_explosion;
        this.x = x;
        this.y = y;
        this.team = team;
        this.power = power;
        this.up = cells.up;
        this.down = cells.down;
        this.right = cells.right;
        this.left = cells.left;
    }

    nowTick()/*void*/ {
        if (!this.gs.server) return;
        if (this.remove) {
            this.gs.units.remove(this);
        }
        this.remove = true;
    }

    load(buf/*Buffer*/, modified/*number*/) {
        super.load(buf, modified);
        if ((modified & Unit.BIT_CONSTANT) != 0) {
            this.team = buf.pop();
            this.power = buf.pop();
            this.up = buf.pop();
            this.down = buf.pop();
            this.left = buf.pop();
            this.right = buf.pop();
        }
    }

    save(buf/*Buffer*/, modified/*number*/) {
        super.save(buf, modified);
        if ((modified & Unit.BIT_CONSTANT) != 0) {
            buf.push(this.team);
            buf.push(this.power);
            buf.push(this.up);
            buf.push(this.down);
            buf.push(this.left);
            buf.push(this.right);
        }
    }
}


export class UnitView {
    constructor(unit/*Unit*/) {
        this.unit = unit;
        this.type = unit.type;
    }
    x/*number*/ = 0;
    y/*number*/ = 0;
    type/*number*/ = 0;

    updateFrame(delta/*number*/, frac/*number*/) {

    }

    updateTick() {

    }
}
