/**
 * Set up the express server with request handlers
 */
var fs = require("fs");
var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
var passport = require('passport');
var path = require('path');
var routes = require('./routes');
var account = require('./account');


var app = express();
var docRoot = path.join(__dirname, '../TempHire/');

// set up express sessions using memory store
app.use(session({  
  secret: 'temphire',
  resave: false,
  saveUninitialized: false
}));

// Set up passport sessions
app.use(passport.initialize());
app.use(passport.session());


// parse application/json 
app.use(bodyParser.json({limit: '10mb'}));

app.get('/', function(req,res) {
    res.sendFile(docRoot + 'index.html');
});

// default controller
app.get('/breeze/Metadata', account.isLoggedIn(), routes.getMetadata);
app.get('/breeze/lookups', account.isLoggedIn(), routes.lookups);
app.post('/breeze/savechanges', account.isLoggedIn(), routes.saveChanges);

// login
app.post('/breeze/account/login', account.login(), account.success);
app.post('/breeze/account/logout', account.logout);

// named save
// app.post('/breeze/saveWithComment', routes.saveWithComment);

// all other breeze queries go to resourcemgt
app.get('/breeze/resourcemgt/:slug', account.isLoggedIn(), noCache, routes.get);

// all other files
app.get(/^(.+)$/, function(req, res) {
    res.sendFile(docRoot + req.params[0]);
});

app.use(logErrors);
app.use(errorHandler);

app.listen(3000);
console.log('Listening on port 3000');

function noCache(req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next();
}

function errorHandler(err, req, res, next) {
  var status = err.statusCode || 500;
  var body = err.message || err;
  res.status(status).send(body);
}

function logErrors(err, req, res, next) {
    console.error(err.stack);
    next(err);
}