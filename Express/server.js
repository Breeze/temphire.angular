/**
 * Set up the express server with request handlers
 */
var fs = require("fs");
var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');
var routes = require('./routes');

var app = express();
var docRoot = path.join(__dirname, '../TempHire/');

// parse application/json 
app.use(bodyParser.json({limit: '10mb'}));

app.get('/', function(req,res) {
    res.sendFile(docRoot + 'index.html');
});

// default controller
app.get('/breeze/Metadata', routes.getMetadata);
app.get('/breeze/lookups', routes.lookups);
app.post('/breeze/savechanges', routes.saveChanges);

// named save
// app.post('/breeze/saveWithComment', routes.saveWithComment);

// all other breeze queries go to resourcemgt
app.get('/breeze/resourcemgt/:slug', noCache, routes.get);

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