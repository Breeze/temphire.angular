/**
 * User login
 */
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

// fake user for testing
const Admin = {
  username: 'Admin',
  password: 'password',
  id: 1
};

// save user info in the session
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

// get user info from the session
passport.deserializeUser(function(id, done) {
  findUserById(id, function(err, user) {
    done(err, user);
  });
});

// TODO: look up user in a database
function findUser(username, callback) {
  if (username === Admin.username) {
    return callback(null, Admin);
  }
  return callback(null);
}

// TODO: look up user in a database
function findUserById(id, callback) {
  if (id === Admin.id) {
    return callback(null, Admin);
  }
  return callback(null);
}

// set up password authentication
passport.use(new LocalStrategy(
  function(username, password, done) {
    findUser(username, function (err, user) {
      if (err) {
        return done(err);
      }
      if (!user) {
        return done(null, false);
      }
      if (password !== user.password  ) {
        return done(null, false);
      }
      return done(null, user);
    })  
  }
));

// middleware to check if user is already authenticated
exports.isLoggedIn = function() {  
  return function (req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).send();
  }
}

// authenticate user
exports.login = function() {
  return passport.authenticate('local'); 
}

// login success
exports.success = function(req, res) {
  res.redirect('/');
}

// logout & refresh
exports.logout = function(req, res) {
  req.logout();
  res.redirect('/');    
}
