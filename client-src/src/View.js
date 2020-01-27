import * as Game from "../../shared/Game";

const ArrBuffer = Game.ArrBuffer;

export { ArrBuffer };

var canvas;

// export interface Animation {
//     sx;
//     sy;
//     sizeX;
//     sizeY;
//     frameWidth;
//     frameHeight;
//     renderWidth;
//     renderHeight;
//     speed;
// }

export class GameApp {
    constructor() {
        canvas = document.getElementById("canvas0");
    }

    getAnimation(name) {
        return window.animations[name];
    }

    getResource(name) {
        return window.resources[name];
    }

    // gs: Game.GameState;
    // gsTest: Game.GameState;

    testGidCounter = 15;
    serverInterval = 0;

    startTestServer() {
        if (this.serverInterval != 0)
            window.clearInterval(this.serverInterval);

        this.serverInterval = window.setInterval(() => {
            this.gsTest.gameLoop();
        }, GameApp.refreshTime);

        var gs = this.gsTest = new Game.GameState(true);
        gs.uid = this.testGidCounter++;
        var me = new Game.Observer();
        me.sendBuf = (buf) => {
            this.receiveMsg(buf);
            return true;
        };
        gs.server.addObserver(me);
    }

    static refreshTime = 333;
    prevTime = 0;
    prevUpdate = 0;
    animID = 0;
    keyID = 0;

    setKeys(side) {
        this.gs.client.key.setKeys(side);
    }

    keyBomb() {
        if (this.gs)
            this.gs.client.key.bomb();
    }

    // tilesManager: Tile;
    static HELP_TIME = 6000;
    timeInGame = GameApp.HELP_TIME;

    startGame() {
        this.tilesManager = new Tile(this.gs, this.getAnimation("tiles").sizeX);
        this.prevTime = Date.now();
        this.prevUpdate = Date.now();
        if (this.animID <= 0) {
            this.animID = window.requestAnimationFrame(() => { this.animate(Date.now()) });
        }
        if (this.keyID <= 0) {
            this.keyID = setInterval(() => { if (this.gs) this.gs.client.key.keyTick(); }, 100);
        }
    }

    stopGame() {
        if (this.keyID > 0)
            window.clearInterval(this.keyID);
        if (this.animID > 0)
            window.cancelAnimationFrame(this.animID);
    }

    onGameStart() {
    }

    receiveMsg(buf) {
        buf.mode = Game.Buffer.MODE_READ;
        var type = buf.pop();
        if (type == Game.CODE_NEW_GAME) {
            this.gs = new Game.GameState(false);
            this.gs.decodeBoot(buf);
            this.gs.client.createView = (unit)/*: Game.UnitView*/ => {
                if (unit.type == Game.unit_char)
                    return new CharacterView(unit);
                if (unit.type == Game.unit_bomb)
                    return new BombView(unit);
                if (unit.type == Game.unit_explosion)
                    return new ExplosionView(unit);
                return null;
            }

            if (this.gsTest)
                this.gs.client.sendIt = (buf) => {
                    this.gsTest.server.observers[0].decode(buf);
                }

            this.onGameStart();
            this.startGame();
        } else if (type == Game.CODE_DIFF) {
            var gid = buf.pop();
            if (gid == this.gs.uid) {
                //this.gs.unixTime = buf.pop();
                //TODO: make it in personal State
                this.gs.client.respawnCoolDown = buf.pop();
                this.gs.win = buf.pop();
                this.gs.inputBuf = buf;
                this.gs.gameLoop();
                this.prevUpdate = Date.now();
            }
        }
    }

    animate(curTime) {
        var delta = curTime - this.prevTime;
        var frac = Math.min(1.0, (curTime - this.prevUpdate) / GameApp.refreshTime);
        this.prevTime = curTime;
        for (var id in this.gs.client.views) {
            var view = this.gs.client.views[id];
            view.updateFrame(delta, frac);
        }
        this.draw(frac, delta);
        this.animID = requestAnimationFrame(() => { this.animate(Date.now()) });
    }

    draw(frac, deltaTime) {
        var zoom = 32;
        var context = canvas.getContext("2d");
        var atlas = this.getResource("tiles");
        var tiles = this.getAnimation("tiles");
        context.save();
        context.translate(zoom, zoom);
        context.scale(zoom, zoom);
        var w = this.gs.map.w, h = this.gs.map.h;
        for (var x = -1; x <= w; x++)
            for (var y = -1; y <= h; y++) {
                var tile = this.tilesManager.tileOf(x, y);
                context.drawImage(atlas, (tile % tiles.sizeX) * tiles.frameWidth, (tile / tiles.sizeX | 0) * tiles.frameWidth, tiles.frameWidth, tiles.frameWidth, x, y, 1, 1);
            }
        context.fillStyle = "green";
        for (var id in this.gs.client.views) {
            var view = this.gs.client.views[id];
            if (view.type == Game.unit_char) {
                var char = /*Game.Character*/view.unit;
                var charView = /*CharacterView*/view;
                var anim = this.getAnimation(char.team == 1 ? "char1" : "char2");
                var frame = (charView.step / anim.speed % anim.sizeX) | 0;
                var side = charView.side;
                if (!char.isAlive()) {
                    frame = (charView.death / anim.speed) | 0;
                    side = 4;
                    if (frame >= anim.sizeX)
                        frame = anim.sizeX - 1;
                } else if ((char.hp + Game.Character.HP_DEF) % 2)
                    continue;
                context.drawImage(atlas,
                    anim.sx + frame * anim.frameWidth, anim.sy + side * anim.frameHeight,
                    anim.frameWidth, anim.frameHeight,
                    view.x + 0.5 - anim.renderWidth / 2, view.y + 0.5 - anim.renderHeight / 2,
                    anim.renderWidth, anim.renderHeight);
            }

            if (view.type == Game.unit_bomb) {
                var bomb = /*Game.Bomb*/view.unit;
                var bombView = /*BombView*/view;
                var anim = this.getAnimation(bomb.team == 1 ? "bomb1" : "bomb2");
                var frame = (bombView.step / anim.speed % anim.sizeX) | 0;
                context.drawImage(atlas,
                    anim.sx + frame * anim.frameWidth, anim.sy,
                    anim.frameWidth, anim.frameHeight,
                    view.x + 0.5 - anim.renderWidth / 2, view.y + 0.5 - anim.renderHeight / 2,
                    anim.renderWidth, anim.renderHeight);
            }

            if (view.type == Game.unit_explosion) {
                var explosionView = /*ExplosionView*/view;
                var explosion = /*Game.Explosion*/view.unit;
                var anim = this.getAnimation(explosion.team == 1 ? "expl1" : "expl2");
                explosionView.draw(anim, atlas, context);
            }
        }
        if (this.gs.client.playerId != 0) {
            var mainChar = this.gs.client.mainCharacter;
            anim = this.getAnimation("arrow");
            if (mainChar != null) {
                var mainView = mainChar.view;
                context.drawImage(atlas,
                        anim.sx, anim.sy,
                        anim.frameWidth, anim.frameHeight,
                        mainView.x, mainView.y - 1,
                        anim.renderWidth, anim.renderHeight);
                anim = this.getAnimation("bombCoolDown");
                var frame = 0;
                if (mainChar.bombsCount != 2) {
                    frame = 1 - mainChar.getBombsPlaced();
                } else {
                    frame = 4 - mainChar.getBombsPlaced();
                }
                context.drawImage(atlas,
                            anim.sx + frame * anim.frameWidth, anim.sy,
                            anim.frameWidth, anim.frameHeight,
                            w-1, -1,
                            anim.renderWidth, anim.renderHeight);
            } else {
                var team = this.gs.client.playerId <= 2 ? 1 : 2;
                var p = this.gs.map.exit[team];
                context.drawImage(atlas,
                        anim.sx, anim.sy,
                        anim.frameWidth, anim.frameHeight,
                        p.x, p.y - 1,
                        anim.renderWidth, anim.renderHeight);
                if (this.gs.client.respawnCoolDown > 0) {
                    anim = this.getAnimation("respawnCoolDown");
                    var delta = (this.gs.client.respawnCoolDown - frac) / Game.Character.RESPAWN_COOLDOWN;
                    context.drawImage(atlas,
                        anim.sx, anim.sy,
                        anim.frameWidth, anim.frameHeight,
                        w-4, -1,
                        anim.renderWidth, anim.renderHeight);
                    context.fillStyle = "red";
                    context.fillRect(w-4 +  4 / zoom, -1 + 14 / zoom, delta * 88 / zoom, 4 / zoom);
                }
            }            
        }
        context.restore();
        if (this.gs.win != 0) {
            context.globalAlpha = 0.3;
            context.fillStyle = "black";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.globalAlpha = 1.0;
            var s = "";
            if (this.gs.win == 1)
                s = "BUGS WIN";
            else s = "ROBOTS WIN";
            window.drawWord(context, canvas.width/2 - 4*26, canvas.height/2 - 10, s);
        } else if (this.timeInGame > 0) {
            var alpha = this.timeInGame / GameApp.HELP_TIME;
            alpha = 1 - Math.sqrt(1 - alpha);
            context.globalAlpha = alpha*0.5;
            context.fillStyle = "black";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.globalAlpha = Math.min(alpha * 4.0, 1.0);
            window.drawWordCenter(context, canvas.width / 2, 50, "Use your bombs");
            window.drawWordCenter(context, canvas.width / 2, 80, "to blow up");
            window.drawWordCenter(context, canvas.width / 2, 110, "enemy roads");
            window.drawWordCenter(context, canvas.width / 2, 140, "Your team wins");
            window.drawWordCenter(context, canvas.width / 2, 170, "when a way");
            window.drawWordCenter(context, canvas.width / 2, 200, "from entrance");
            window.drawWordCenter(context, canvas.width / 2, 230, "point to the exit");
            window.drawWordCenter(context, canvas.width / 2, 260, "is ready");
            context.globalAlpha = 1.0;
            this.timeInGame -= deltaTime;
        }
    }
}

export class Tile {

    constructor(gs/*: Game.GameState*/, cols_per_row) {
        this.gs = gs;
        this.cols_per_row = cols_per_row;
    }

    get (row, col) {
        return row * this.cols_per_row + col;
    }

    tileOf(x, y) {
        var tile = this.gs.map.get(x, y);
        if (tile == Game.tile_unbreakable) {
            if (x == -1 || x == this.gs.map.w || y == -1 || y == this.gs.map.h)
                return this.tileOfBorder(x, y);
            return this.get(0, 3);
        }
        if (tile == Game.tile_wall) {
            return this.tileOfWall(x, y);
        }
        if (tile == Game.tile_floor) {
            return this.get(1, 1);
        }
        if ((tile & Game.tile_exit) == Game.tile_exit) {
            var v = 2;
            var dn = this.gs.map.get(x, y + 1);
            if ((dn & Game.tile_road) == Game.tile_road)
                v = (dn & 3) - 1;
            return this.get(5 - (tile&3), v);
        }
        if ((tile & Game.tile_road) == Game.tile_road) {
            var u1 = this.gs.map.get(x, y - 1), d1 = this.gs.map.get(x, y + 1),
                l1 = this.gs.map.get(x - 1, y), r1 = this.gs.map.get(x + 1, y);
            if ((d1 & Game.tile_exit) == Game.tile_exit) u1 |= 3;
            if ((d1 & Game.tile_exit) == Game.tile_exit) d1 = 0;
            if ((l1 & Game.tile_exit) == Game.tile_exit) l1 = 0;
            if ((r1 & Game.tile_exit) == Game.tile_exit) r1 = 0;
            var up = (tile & u1) == tile;
            var down = (tile & d1) == tile;
            var left = (tile & l1) == tile;
            var right = (tile & r1) == tile;
            var row = 0, col = 0;
            if (up) {
                if (down) {
                } else if (left) {
                    row = 2;
                    col = 1;
                } else if (right) {
                    row = 2;
                    col = 0;
                }
            } else if (down) {
                if (left) {
                    row = 1; col = 1;
                } else if (right) {
                    row = 1; col = 0;
                }
            } else {
                row = 0;
                col = 1;
            }
            if ((tile & Game.tile_active) == Game.tile_active)
                col += 2;
            if ((tile & 1) == 1)
                col += 4;
            row += 2;
            col += 3;
            return this.get(row, col);
        }
        return this.get(1, 1);
    }

    tileOfBorder(x, y) {
        if (x == -1) {
            if (y == -1)
                return this.get(0, 0);
            else if (y == this.gs.map.h)
                return this.get(1, 0);
            else
                return this.get(1, 0);
        }
        if (x == this.gs.map.w) {
            if (y == -1)
                return this.get(0, 2);
            else if (y == this.gs.map.h)
                return this.get(2, 2);
            else
                return this.get(1, 2);
        }
        if (y == -1)
            return this.get(0, 1);
        return this.get(2, 1);
    }

    tileOfWall(x, y) {
        var prev = this.gs.map.get(x, y - 1) == Game.tile_wall;
        var next = this.gs.map.get(x, y + 1) == Game.tile_wall;
        if (prev && next)
            return this.get(1, 5);
        if (prev)
            return this.get(1, 4);
        if (next)
            return this.get(0, 4);
        return this.get(0, 5);
    }

}

export class LinearView extends Game.UnitView {
    prevX = 0;
    prevY = 0;
    tickX = 0;
    tickY = 0;

    constructor(unit/*: Game.Unit*/) {
        super(unit);
        this.prevX = this.tickX = unit.x;
        this.prevY = this.tickY = unit.y;
    }

    updateFrame(delta, frac) {
        this.x = this.prevX + frac * (this.tickX - this.prevX);
        this.y = this.prevY + frac * (this.tickY - this.prevY);
    }

    updateTick() {
        this.prevX = this.tickX;
        this.prevY = this.tickY;
        this.tickX = this.unit.x;
        this.tickY = this.unit.y;
    }
}

export class CharacterView extends LinearView {
    static rows = [0, 2, 0, 3, 1];
    step = 0;
    death = 0;
    side = CharacterView.rows[0];
    constructor(unit/*: Game.Unit*/) {
        super(unit);
    }
    go = false;

    updateFrame(delta, frac) {
        super.updateFrame(delta, frac);
        if (!/*Game.Character*/this.unit.isAlive()) {
            this.death += delta;
        } else {
            if (this.go)
                this.step += delta;
            else this.step = 0;
        }
    }

    updateTick() {
        super.updateTick();
        var keys = (/*<Game.Character>*/this.unit).keys;
        this.go = keys != 0;
        if (this.go)
            this.side = CharacterView.rows[keys];
    }
}

export class BombView extends LinearView {
    step = 0;

    constructor(unit/*: Game.Unit*/) {
        super(unit);
    }

    updateFrame(delta, frac) {
        super.updateFrame(delta, frac);
        this.step += delta;
    }

    updateTick() {
        super.updateTick();
    }
}

export class ExplosionView extends LinearView {
    step = 0;

    constructor(unit/*: Game.Unit*/) {
        super(unit);
    }

    updateFrame(delta, frac) {
        super.updateFrame(delta, frac);
        this.step += delta;
    }

    updateTick() {
        super.updateTick();
    }

    draw(anim, atlas, context) {
        var explosion = /*<Game.Explosion>*/ this.unit;
        var cells = [];
        cells.push({x: 0, y: 0, type: 0});
        this.go(explosion.down, 0, 1, 1, 2, cells);
        this.go(explosion.up, 0, -1, 1, -1, cells);
        this.go(explosion.left, -1, 0, 3, 5, cells);
        this.go(explosion.right, 1, 0, 3, 4, cells);
        var frame = (this.step / anim.speed % anim.sizeX) | 0;
        var dx = this.x + 0.5 - anim.renderWidth / 2;
        var dy = this.y + 0.5 - anim.renderHeight / 2;

        for (var el in cells) {
            var x = cells[el].x + dx;
            var y = cells[el].y + dy;
            var type = cells[el].type;
            this.drawImage(
                context, atlas,
                anim.sx + frame * anim.frameWidth,
                anim.sy + type * anim.frameHeight,
                anim.frameWidth, anim.frameHeight,
                x, y,
                anim.renderWidth, anim.renderHeight
            );

        }

    }

    go(steps, dx, dy, type1, type2, cells)/*: void*/ {
        for (var i = 1; i <= steps; ++i) {
            var x = i * dx;
            var y = i * dy;
            if (i == steps) {
                cells.push({x: x, y: y, type: type2});
            } else {
                cells.push({x: x, y: y, type: type1});
            }
        }
    }

    drawImage(context, atlas, sx, sy, sw, sh, x, y, w, h)/*: void*/ {
        context.drawImage(
            atlas,
            sx, sy,
            sw, sh,
            x, y,
            w, h
        );
    }
}
