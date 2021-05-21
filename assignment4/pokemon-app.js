'use strict'
// Requires
const express = require('express');
const session = require('express-session')
const app = express();
const fs = require("fs");
const mysql = require('mysql');
const { JSDOM } = require('jsdom');
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const morgan = require('morgan');
const path = require('path');
const rfs = require('rotating-file-stream');



// another potential topic, no time :/
// https://www.npmjs.com/package/express-brute

// static path mappings
app.use('/js', express.static('assets/js'));
app.use('/css', express.static('assets/css'));
app.use('/img', express.static('assets/imgs'));
app.use('/fonts', express.static('assets/fonts'));
app.use('/html', express.static('assets/html'));
app.use('/media', express.static('assets/media'));

//logging
const accessLogStream = rfs.createStream('access.log', {
    interval: '1d', // rotate daily
    path: path.join(__dirname, 'assets/log')
});

app.use(morgan(':referrer :url :user-agent',
    { stream: accessLogStream }));

app.use(session(
    {
        secret: 'extra text that no one will guess',
        name: 'wazaSessionID',
        resave: false,
        saveUninitialized: true
    }));

app.get('/', function (req, res) {
    let doc = fs.readFileSync('./assets/html/home.html', "utf8");

    // let's make a minor change to the page before sending it off ...
    let dom = new JSDOM(doc);
    let $ = require("jquery")(dom.window);


    let dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    let d = new Date().toLocaleDateString("en-US", dateOptions);
    $("#footer").append("<p>Copyright ©2021, Pok&eacute;-App, Inc. Updated: " + d + "</p>");

    initDB();

    res.set('Server', 'Wazubi Engine');
    res.set('X-Powered-By', 'Wazubi');
    res.send(dom.serialize());

});


// async together with await
async function initDB() {

    const mysql = require('mysql2/promise');
    // Let's build the DB if it doesn't exist
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        multipleStatements: true
    });

    const createDBAndTables = `CREATE DATABASE IF NOT EXISTS test;
        use test;
        DROP TABLE user; 
        CREATE TABLE IF NOT EXISTS user (
        ID int NOT NULL AUTO_INCREMENT,
        name varchar(30),
        email varchar(30),
        password varchar(30),
        PRIMARY KEY (ID));`;

    // Used to wait for a promise to finish ... IOW we are avoiding asynchronous behavior
    // Why? See below!
    try {
    results = await connection.query("INSERT INTO user (name, email, password) values ('Arron', 'arron_ferguson@bcit.ca', 'admin')");
    results = await connection.query("INSERT INTO user (name, email, password) values ('CoolKid', 'admin1@bcit.ca', 'admin')");
    results = await connection.query("INSERT INTO user (name, email, password) values ('SmartKid', 'admin2@bcit.ca', 'admin')");
    results = await connection.query("INSERT INTO user (name, email, password) values ('AwesomeKid', 'admin3@bcit.ca', 'admin')");
    results = await connection.query("INSERT INTO user (name, email, password) values ('AmazingKid', 'admin4@bcit.ca', 'admin')");
    } catch(error) {
        console.error("Error in inserting data into table");
    }
    connection.end();
}

app.get('/profile', function (req, res) {

    // check for a session first!
    if (req.session.loggedIn) {

        // DIY templating with DOM, this is only the husk of the page
        let templateFile = fs.readFileSync('./assets/templates/profile_template.html', "utf8");
        let templateDOM = new JSDOM(templateFile);
        let $template = require("jquery")(templateDOM.window);

        // put the name in
        $template("#profile_name").attr("value", `${req.session.name}(${req.session.email})!`);
        $template("#greeting").html("Welcome!&nbsp<span id='username'>" + req.session.name + '</span>');

        // insert the left column from a different file (or could be a DB or ad network, etc.)
        let left = fs.readFileSync('./assets/templates/left_card.html', "utf8");
        let leftDOM = new JSDOM(left);
        let $left = require("jquery")(leftDOM.window);
        // Replace!
        $template("#left_placeholder").replaceWith($left("#left_card"));

        // insert the middle column from a different file (or could be a DB or ad network, etc.)
        let middle = fs.readFileSync('./assets/templates/middle_card.html', "utf8");
        let middleDOM = new JSDOM(middle);
        let $middle = require("jquery")(middleDOM.window);
        // Replace!
        $template("#middle_placeholder").replaceWith($middle("#middle_card"));

        // insert the right column from a different file (or could be a DB or ad network, etc.)
        let right = fs.readFileSync('./assets/templates/right_card.html', "utf8");
        let rightDOM = new JSDOM(right);
        let $right = require("jquery")(rightDOM.window);
        // Replace!
        $template("#right_placeholder").replaceWith($right("#right_card"));

        res.set('Server', 'Wazubi Engine');
        res.set('X-Powered-By', 'Wazubi');
        res.send(templateDOM.serialize());

    } else {
        // not logged in - no session!
        res.redirect('/');
    }

});


// No longer need body-parser!
app.use(express.json());
app.use(express.urlencoded({ extended: true }))

// Notice that this is a 'POST'
app.post('/authenticate', function (req, res) {
    res.setHeader('Content-Type', 'application/json');

    let results = authenticate(req.body.email, req.body.password,
        function (rows) {
            // console.log(rows.password);
            if (rows == null) {
                // not found
                res.send({ status: "fail", msg: "User account not found." });
            } else {
                // authenticate the user, create a session
                req.session.loggedIn = true;
                req.session.name = rows.name;
                req.session.email = rows.email;
                res.send({ status: "success", msg: "Logged in." });
            }
        });

});

function authenticate(email, pwd, callback) {

    const mysql = require('mysql2');
    const connection = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'test'
    });

    connection.query(
        "SELECT * FROM user WHERE email = ? AND password = ?", [email, pwd],
        function (error, results) {
            if (error) {
                throw error;
            }

            if (results.length > 0) {
                // email and password found
                return callback(results[0]);
            } else {
                // user not found
                return callback(null);
            }

        });

}

app.get('/dashboard', function (req, res) {
    req.session.destroy(function (error) {
        if (error) {
            console.log(error);
        }
    });
    res.redirect("/");
})



app.get('/logout', function (req, res) {
    req.session.destroy(function (error) {
        if (error) {
            console.log(error);
        }
    });
    res.redirect("/");
})


var userCount = 0;

io.on('connect', function(socket) {
    userCount++;
    socket.userName = " ";

    io.emit('user_joined', { user: socket.userName, numOfUsers: userCount });
    console.log('Connected users:', userCount);

    socket.on('disconnect', function(data) {
        userCount--;
        io.emit('user_left', { user: socket.userName, numOfUsers: userCount });

        console.log('Connected users:', userCount);
    });

    socket.on('chatting', function(data) {

        console.log('User', data.name, 'Message', data.message);

        if(socket.userName == " ") {
            io.emit("chatting", {user: data.name, text: buildMessage(data.message)});
            socket.userName = data.name;

        } else {

            io.emit("chatting", {user: socket.userName, text: buildMessage(data.message)});
        }
    });
});

// replacing :) with emoji
// This block was adapted from code found here:
// source: https://stackoverflow.com/questions/32922932/parse-smilies-in-node-js-and-socket-io-chat-app
const SMILES_MAP = {
    ':)': '&#9786;',
    ':(': '&#9785;'
};

function buildMessage(message) {
    let smiles = Object.keys(SMILES_MAP);
    smiles.forEach(smile => message = message.replace(smile, SMILES_MAP[smile]));
    return message;
}
// adapted block end.



// Run Server
let port = 8000;
server.listen(port, function () {
    console.log('Listening on port ' + port + '!');
})
