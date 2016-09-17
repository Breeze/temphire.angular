/**
 * Set up the express server with request handlers
 */
var fs = require("fs");
var express = require('express');
var routes = require('./routes');

var app = express();
var docRoot = "C:/git/Breeze/temphire.angular2/TempHire/";

//Set Request Size Limit
app.use(express.bodyParser({limit: '50mb'}));
// app.use(express.methodOverride());
app.use(app.router);
app.use(logErrors);
app.use(errorHandler);

app.get('/', function(req,res) {
    res.sendfile(docRoot + 'index.html');
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
    res.sendfile(docRoot + req.params[0]);
});

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
  if (err.message) {
      res.send(status, err.message);
  } else {
      res.send(status, err);
  }
}

function logErrors(err, req, res, next) {
    console.error(err.stack);
    next(err);
}