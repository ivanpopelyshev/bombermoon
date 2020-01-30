import { GameApp, ArrBuffer } from './View';
import io from 'socket.io-client';

var app = null;

function doConnect() {
  app = new GameApp();
  var socket = io.connect(`${window.location.protocol}//${window.location.host}`);
  socket.on('game', function (data) {
    app.receiveMsg(new ArrBuffer(data));
  }).on('disconnect', function (data) {
    app.stopGame();
    app = null;
    startup();
  });
  app.onGameStart = function () {
    app.gs.client.sendIt = function (buf) {
      if (!socket.disconnected)
        socket.emit("orders", buf.source);
    }
  }
}

function doTest() {
  app = new GameApp();
  app.startTestServer();
}
var canvas;

window.drawWordCenter = function(context, x, y, word) {
  var anim = animations["font"];
  drawWord(context, x-anim.renderWidth/2*word.length, y-anim.renderHeight/2, word);
}

window.drawWord = function(context, x, y, word) {
  var anim = animations["font"];
  var res = resources["font"];
  var s = "AZaz";
  for (var i = 0; i < word.length ; i++) {
    var c = -1;
    var d = word.charCodeAt(i);

    if (d >= s.charCodeAt(0) && d <= s.charCodeAt(1))
      c = d - s.charCodeAt(0);
    if (d >= s.charCodeAt(2) && d <= s.charCodeAt(3))
      c = d - s.charCodeAt(2);
    if (c >= 0) {
      context.drawImage(res, (c % anim.sizeX) * anim.frameWidth, (c / anim.sizeX | 0) * anim.frameHeight, anim.frameWidth, anim.frameHeight,
          x + i * anim.renderWidth, y, anim.renderWidth, anim.renderHeight);
    }
  }
}

window.drawSplash = function () {
  var w = canvas.width, h = canvas.height;
  var context = canvas.getContext("2d");
  context.fillStyle = "black";
  context.fillRect(0, 0, w, h);

  var moon_nano = resources["bm-moon_nano"];
  var moon_mini = resources["bm-moon_mini"];
  var moon = resources["bm-moon"];
  var robo = resources["bm-robo-splash"];
  var bug = resources["bm-bug-splash"];
  var splash_logo = resources["bm-logo-splash"];
  var donate = resources["donate"];

  context.drawImage(moon_nano, (w / 2) - (moon_nano.width / 2), (h / 4) - (moon_nano.height / 2));
  context.drawImage(moon_mini, (w / 2) - (moon_mini.width / 2), (h / 2) - (moon_mini.height / 2));
  context.drawImage(moon, (w / 2) - (moon.width / 2), h - moon.height);
  context.drawImage(robo, 0, h - robo.height);
  context.drawImage(bug, w - bug.width, h - bug.height);
  context.drawImage(splash_logo, (w / 2) - (splash_logo.width / 2), h / 8);

  drawWordCenter(context, canvas.width / 2, canvas.height/2 + 50, "CLICK TO JOIN");

  context.drawImage(donate, canvas.width / 2 - donate.width / 2, canvas.height - donate.height - 8);
  drawWord(context, canvas.width / 2 - 26 * 3, canvas.height - donate.height +4, "DONATE");
}

function startup() {
  canvas = document.getElementById("canvas0");
  var splashInterval = window.setInterval(function () { drawSplash(); }, 100);
   // PAYPAL
  var clicker = function () {
    // $("#payment-form").hide();
    canvas.removeEventListener("click", clicker);
    clearInterval(splashInterval);
    doConnect();
  };
  canvas.addEventListener("click", clicker);
  // $("#payment-form").show();
}

function addAnimations(zoom, anims) {
  for (var id in anims) {
    var anim = anims[id];
    anim.frameWidth = anim.frameWidth || zoom;
    anim.frameHeight = anim.frameHeight || zoom;
    anim.renderWidth = anim.frameWidth / zoom;
    anim.renderHeight = anim.frameHeight / zoom;
    animations[id] = anim;
  }
}

var resLoaded = 0, resCount = 0;
window.resources = {}
window.animations = {}

var defZoom = 32;
addAnimations(defZoom, {
  tiles: { sx: 0, sy: 0, sizeX: 11, sizeY: 5 },
  char1: { sy: 5 * defZoom, sx: 0, sizeX: 4, sizeY: 4, speed: 100 },
  char2: { sy: 5 * defZoom, sx: 4 * defZoom, sizeX: 4, sizeY: 4, speed: 100 },
  bomb1: { sy: 10 * defZoom, sx: 0, sizeX: 4, sizeY: 1, speed: 100 },
  bomb2: { sy: 10 * defZoom, sx: 4 * defZoom, sizeX: 4, sizeY: 1, speed: 100 },
  expl1: { sy: 12 * defZoom, sx: 0, sizeX: 4, sizeY: 1, speed: 100 },
  expl2: { sy: 12 * defZoom, sx: 4 * defZoom, sizeX: 4, sizeY: 1, speed: 100 },
  arrow: { sy: 18 * defZoom, sx: 0, sizeX: 1, sizeY: 1 },
  bombCoolDown: { sy: 18 * defZoom, sx: 4 * defZoom, sizeX: 5, sizeY: 1 },
  respawnCoolDown: { sy: 18 * defZoom, sx: defZoom, sizeX: 1, sizeY: 1, frameWidth: defZoom * 3, frameHeight: defZoom }
});
addAnimations(1, {
  font: {sx: 0, sy:0, sizeX: 7, sizeY:4, frameWidth: 26, frameHeight:20}
});

function onLoad(err) {
  resLoaded++;
  if (resLoaded == resCount) {
    startup();
  }
}

function tryLoadImage(name, src) {
  resCount++;
  var img = new Image();
  img.onload = onLoad;
  img.src = src;
  resources[name] = img;
}

window.addEventListener('load', function () {
  (function () {
    var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
    window.requestAnimationFrame = requestAnimationFrame;
    var cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame ||
        window.webkitCancelAnimationFrame || window.msCancelAnimationFrame;
    window.cancelAnimationFrame = cancelAnimationFrame;
  })();

  tryLoadImage("tiles", "img/tiles.png");
  tryLoadImage("bm-logo-splash", "img/splash/bm-logo-splash.png");
  tryLoadImage("bm-arrow", "img/splash/bm-arrow.png");
  tryLoadImage("bm-bug-splash", "img/splash/bm-bug-splash.png");
  tryLoadImage("bm-robo-splash", "img/splash/bm-robo-splash.png");
  tryLoadImage("bm-moon_nano", "img/splash/bm-moon_nano.png");
  tryLoadImage("bm-moon_mini", "img/splash/bm-moon_mini.png");
  tryLoadImage("font", "img/splash/font.png");
  tryLoadImage("bm-moon", "img/splash/bm-moon.png");
  tryLoadImage("donate", "img/donate-btn.png");
  resCount++;
  // require(["js/Game", "js/View"], function (Game, View) {
  //   window.Game = Game;
  //   window.View = View;
  onLoad();
  // });

  var keyMask = 0;

  function keyDown(key) {
    if (!app) return;
    var mask = (1 << key);
    if ((keyMask & mask) == 0) {
      keyMask ^= mask;
      app.setKeys(key);
    }
  }

  function keyUp(key) {
    if (!app) return;
    var mask = (1 << key);
    if ((keyMask & mask) != 0) {
      keyMask ^= mask;
      for (var i = 1; i <= 4; i++)
        if ((keyMask & (1 << i)) != 0)
          return app.setKeys(i);
      app.setKeys(0);
    }
  }

  var docOnKeyDown = function (e) {
    var __keys = [39, 68, 38, 87, 37, 65, 40, 83, 32, 75, 17, 76, 13, 9, 80, 81, 73, 8 /* backspace */],
        code = e.keyCode ? e.keyCode : e.which;
    switch (code) {
      case 39:
      case 68:
        keyDown(1);
        break;
      case 38:
      case 87:
        keyDown(4);
        break;
      case 37:
      case 65:
        keyDown(3);
        break;
      case 40:
      case 83:
        keyDown(2);
        break;
      case 75:
      case 32:
        app.keyBomb();
        break;
    }

    if (~__keys.indexOf(code)) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  var docOnKeyUp = function (e) {
    var __keys = [39, 68, 38, 87, 37, 65, 40, 83, 81, 8 /* backspace */],
        code = e.keyCode ? e.keyCode : e.which;
    switch (code) {
      case 39:
      case 68:
        keyUp(1);
        break;
      case 38:
      case 87:
        keyUp(4);
        break;
      case 37:
      case 65:
        keyUp(3);
        break;
      case 40:
      case 83:
        keyUp(2);
        break;
    }
    if (~__keys.indexOf(code)) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  document.addEventListener('keydown', docOnKeyDown);
  document.addEventListener('keyup', docOnKeyUp);

});