var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var dbConfig = require('./db');

// Connect to DB
mongoose.connect(dbConfig.url + dbConfig.DBname, function (err) {
    if (err) throw err;
    console.log('Successfully connected');
});

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Configuring Passport
var passport = require('passport');
var expressSession = require('express-session');
var MongoDBStore = require('connect-mongodb-session')(expressSession);
var store = new MongoDBStore({
    uri: dbConfig.url,
    collection: 'Sessions'
});

// Catch errors
store.on('error', function(error) {
    console.log(error);
});
app.use(require('express-session')({
    secret: 'This is a secret',
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    },
    store: store,
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

 // Using the flash middleware provided by connect-flash to store messages in session
 // and displaying in templates
var flash = require('connect-flash');
app.use(flash());

// Initialize Passport
var initPassport = require('./passport/init');
initPassport(passport);

var routes = require('./routes/index')(passport);
app.use('/', routes);

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

//----------------------BOT----------------------
 var bot = require('./telegram_bot');
 var email = require('./email');
//---------------------SERVER--------------------
const WebSocket = require('ws');
var Res = require('./res');
var User = require('./models/user');
var SToken = require('./models/sessionToken');
var bCrypt = require('bcrypt-nodejs');
const wss = new WebSocket.Server({ port: 21450,  clientTracking: true });
const jwt = require('jsonwebtoken');
var fs = require('fs');

const secret = fs.readFileSync('secrets.txt', 'utf8');
var clients = [];

wss.on('connection', function connection(ws) {
clients.push(ws);
    console.log( ws.id);
    ws.on('message', function incoming(message) {
        console.log(message);
        let json;
        try {
            json = JSON.parse(message);
        }
        catch (e) {
            ws.send(JSON.stringify(Res.err));
            return;
        }
        if(json.greeting === 'auth'){
            if(!json.username) {ws.send(JSON.stringify(Res.err)); return;}
            User.findOne({ 'username' :  json.username },
                function(err, user) {
                    // In case of any error, return using the done method
                    if (err) {
                        ws.send(JSON.stringify(Res.err));
                        return;
                    }
                    // Username does not exist, log the error and redirect back
                    if (!user){
                        console.log('User Not Found with username '+json.username);
                        ws.send(JSON.stringify(Res.notFound));
                        return;
                    }
                    // User exists but wrong password, log the error
                    if (!isValidPassword(user, json.password)){
                        console.log('Invalid Password');
                        ws.send(JSON.stringify(Res.incPass)); // redirect back to login page
                        return;
                    }
                    // create token
                    const token = jwt.sign({ username: json.username, password:  createHash(json.password)}, secret);
                    ws.send(token);
                    let st = new SToken();
                    st.token = token;
                    st.save(function(err) {
                        if (err){
                            console.log('Error in Saving token: '+err);
                            throw err;
                        }
                        console.log('Token saved');
                    });
                    ws.send(JSON.stringify(Res.ok));
                }
            );
            return;
        }
        if (json.greeting === 'logout'){
        if (!json.token){ws.send(JSON.stringify(Res.err)); return;}
            SToken.findOne({ 'token' :  json.token }, function(err, token) {
                // In case of any error, return using the done method
                if (err){
                    console.log('Error in remove token: '+err);
                    ws.send(JSON.stringify(Res.err));
                    return ;
                }
                // already exists
                if (token) {
                    token.remove();
                    console.log('Token removed');
                    ws.send(JSON.stringify(Res.ok));
                    return;
                }
            });
            return;
        }
        if(json.greeting === 'access'){
            if(!json.token){
                ws.send(JSON.stringify(Res.err));
                return;
            }
            SToken.findOne({ 'token' :  json.token }, function(err, token) {
                // In case of any error, return using the done method
                if (err){
                    console.log('Error in access by token: '+err);
                    ws.send(JSON.stringify(Res.err));
                    return ;
                }
                // already exists
                if (token) {
                    ws.send(JSON.stringify(Res.allow));
                    return;
                }
                ws.send(JSON.stringify(Res.deny));
            });
            return;
        }
        if (json.greeting === 'signup'){
            if(!json.username) {ws.send(JSON.stringify(Res.err)); return;}
            if(!json.password) {ws.send(JSON.stringify(Res.err)); return;}
            if(!json.email) {ws.send(JSON.stringify(Res.err)); return;}
            if(!json.firstName) {ws.send(JSON.stringify(Res.err)); return;}
            if(!json.lastName) {ws.send(JSON.stringify(Res.err)); return;}
            User.findOne({ 'username' :  username }, function(err, user) {
                // In case of any error, return using the done method
                if (err){
                    console.log('Error in SignUp: '+err);
                    ws.send(JSON.stringify(Res.err));
                    return ;
                }
                // already exists
                if (user) {
                    console.log('User already exists with username: ' + json.username);
                    ws.send(JSON.stringify(Res.exist));
                    return ;
                } else {
                    // if there is no user with that email
                    // create the user
                    var newUser = new User();

                    // set the user's local credentials
                    newUser.username = json.username;
                    newUser.password = createHash(json.password);
                    newUser.email = json.email;
                    newUser.firstName = json.firstName;
                    newUser.lastName = json.lastName;

                    // save the user
                    newUser.save(function(err) {
                        if (err){
                            console.log('Error in Saving user: '+err);
                            ws.send('err');
                            throw err;
                        }
                        console.log('User Registration succesful');
                        ws.send(JSON.stringify(Res.ok));
                        return;
                    });
                }
            });
            return;
        }
        if(json.greeting === 'message'){
            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send('hello everyone!');
                }
                clients[0].send('first');
            });

            return;
        }
        if(json.greeting === 'message_telegram'){
            if(json.chatId) {ws.send(JSON.stringify(Res.err));
            bot.sendMessage(json.chatId, 'hello fella');}
            if(!json.email) { return;}
            email.sendMessage(json.email);
            return;
        }
        ws.send(JSON.stringify(Res.invalid));
    });

    ws.send('well met!');
});

var isValidPassword = function(user, password){
    return bCrypt.compareSync(password, user.password);
}
var createHash = function(password){
    return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
}
module.exports = app;
