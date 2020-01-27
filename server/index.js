const http = require("http");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const md5 = require("md5");
const uuid = require("uuid");
const app = express();
const { startWsServer } = require("./sockets");

const api_secret = 'xxx';

app.use(cors());
app.use("/api", express.json());

const userByViewer = {}, userByToken = {};

class User {
    constructor (options) {
        const { token, viewer_id } = options || {};
        this.token = token || uuid();
        this.viewer_id = viewer_id || 0;
        this.score = 0;
    }
}

function getUser(req) {
    const {viewer_id, api_id, auth_key} = req.query;
    const check_auth_key = md5(api_id + '_' + viewer_id + '_' + api_secret);

    if (auth_key !== check_auth_key) {
        return false;
    }

    if (!userByViewer[viewer_id]) {
        const usr = new User({ viewer_id });
        userByViewer[viewer_id] = userByToken[usr.token] = usr;
    }

    return userByViewer[viewer_id];
}

function uglyTemplate(req, res) {
    let usr = getUser(req, res);
    if (!usr) {
        usr = new User({
            token: 'anon',
            viewer_id: 0
        });
        // res.send(403);
        // return;

    }

    const jsCode = `
    window.config = {
        token: "${usr.token}",
        score: ${usr.score},
    };
    console.log('config is ', window.config);
`;

    fs.readFile('client/index.html', 'utf8', (err, data) => {
        const result = data.replace("/* AUTH */", jsCode)
            .replace("<script></script>", `<script>${jsCode}</script>`);
        res.send(result);
    });
};

app.get("/", uglyTemplate);
app.get("/index.html", uglyTemplate);

app.get("/api", (req, res)=>{
    res.send({
        VERSION: 10
    })
});

let changed = false;

app.post("/api/setscore", (req, res)=>{
    const {token, score} = req.body;
    const usr = userByToken[token];
    if (!usr) {
        res.send(403);
        return;
    }
    if (usr.score === score) {
        res.send('SAME');
    } else {
        usr.score = score;
        changed = true;
        res.send('OK');
    }
});

app.use("/", express.static(__dirname + "/../client" ));

const server = http.createServer(app);

server.listen(8080, "0.0.0.0", ()=>{
    console.log("Server started on:", 8080);
});

setInterval(() => {
    if (!changed) {
        return;
    }
    let top = Object.values(userByToken);
    top.sort((a, b) => { return a.score - b.score});
    console.log('===Top Score===');
    top.forEach((usr) => {
        console.log(`${usr.score} - ${usr.viewer_id} - ${usr.token}`);
    });
    changed = false;
}, 5000);

startWsServer(server);