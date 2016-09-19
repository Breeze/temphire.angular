/**
 * Define the query and save handlers for the routes in the application
 */
var fs = require('fs');
var Promise = require("bluebird");
var breezeSequelize = require('breeze-sequelize');

var SequelizeManager = breezeSequelize.SequelizeManager;
var SequelizeQuery = breezeSequelize.SequelizeQuery;
var SequelizeSaveHandler = breezeSequelize.SequelizeSaveHandler;

// Don't use this
// var breeze = require('breeze-client');
// Use this
var breeze = breezeSequelize.breeze;
var EntityQuery = breeze.EntityQuery;

var dbfile = "temphire.db";
var metafile = "metadata.json";

var _seqOpts = {
  dialect: "sqlite",
  storage: "temphire.db",
  define: {
      freezeTableName: false  // let sequelize pluralize table names
  },
  logging: function(msg) {
      console.log(msg.substring(0, 100) + '...');  // truncate sequelize info messages
  }
}

var _sequelizeManager = createSequelizeManager();

function createSequelizeManager() {
  if (!fs.existsSync(metafile)) {
    next(new Error("Unable to locate file: " + metafile));
  }
  var metadata = fs.readFileSync(metafile, 'utf8');
  var sm = new SequelizeManager({}, _seqOpts);
  sm.importMetadata(metadata);

  // sm.keyGenerator = new KeyGenerator(sm.sequelize);
  return sm;
}

exports.getMetadata = function(req, res, next) {
    if (!fs.existsSync(metafile)) {
      next(new Error("Unable to locate file: " + metafile));
    }
    // var metadata = fs.readFileSync(metafile, 'utf8');
    res.sendFile(metafile, { root: __dirname });
}

exports.lookups = function(req, res, next) {
  namedQuery.lookups(req, res, next);
}

exports.get = function (req, res, next) {
  var resourceName = req.params.slug;
  if (namedQuery[resourceName]) {
    namedQuery[resourceName](req, res, next);
  } else {
    var entityQuery = EntityQuery.fromUrl(req.url, resourceName);
    executeEntityQuery(entityQuery, null, res, next);
  }
};

exports.saveChanges = function(req, res, next) {
  var saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.beforeSaveEntity = beforeSaveEntity;
  saveHandler.beforeSaveEntities = beforeSaveEntities;
  saveHandler.save().then(function(r) {
    returnResults(r, res);
  }).catch(function(e) {
    next(e);
  });
};

function executeEntityQuery(entityQuery, returnResultsFn, res, next) {
  var returnResultsFn = returnResultsFn || returnResults;
  var query = new SequelizeQuery(_sequelizeManager, entityQuery);
  query.execute().then(function (r) {
    returnResultsFn(r, res);
  }).catch(next);
}


function returnResults(results, res) {
  res.setHeader("Content-Type", "application/json");
  res.send(results);
}

/** perform a query, and attach the result set to resultobj[property].  Return the promise. */
function attachResult(queryResource, resultobj, property) {
  property = property || queryResource;
  var q = new SequelizeQuery(_sequelizeManager, EntityQuery.from(queryResource));
  return q.execute().then(function(r){
    resultobj[property] = r;
  });
}

// definitions of custom queries
var namedQuery = {};

// staffingresources get expanded
namedQuery.staffingresources = function(req, res, next) {
  var entityQuery = EntityQuery.fromUrl(req.url, "StaffingResources").expand("Addresses, PhoneNumbers");
  executeEntityQuery(entityQuery, null,  res, next);
}

// staffingresourcelistitems is a projection
namedQuery.staffingresourcelistitems = function(req, res, next) {
  var entityQuery = EntityQuery.fromUrl(req.url, "StaffingResources").expand("Addresses, PhoneNumbers");
  var query = new SequelizeQuery(_sequelizeManager, entityQuery);
  query.execute().then(function (r) {
    var items = [];
    r.forEach(function(staff){
      var addr = getPrimary(staff.Addresses);
      var phon = getPrimary(staff.PhoneNumbers);
      var item = {
        Id: staff.Id,
        FullName: staff.FirstName + ' ' + staff.MiddleName + ' ' + staff.LastName,
        Address1: addr.Address1,
        Address2: addr.Address2,
        City: addr.City,
        State: addr.State && addr.State.ShortName,
        Zipcode: addr.Zipcode,
        PhoneNumber: '(' + phon.AreaCode + ')' + phon.Number
      }
      items.push(item);
    });
    returnResults(items, res);
  }).catch(next);  
}

function getPrimary(arr) {
  if (!(arr && arr.length)) return {};
  for (var i=0; i<arr.length; i++) {
    if (arr[i].Primary) return arr[i];
  }
  return arr[0];
}

// lookups are queries in parallel, sent back as a single result
namedQuery.lookups = function(req, res, next) {
  var result = {};
  var arr = [];

  arr.push(attachResult("AddressTypes", result));
  arr.push(attachResult("PhoneNumberTypes", result));
  arr.push(attachResult("RateTypes", result));
  arr.push(attachResult("States", result));
  
  Promise.all(arr).then(function(r2) {
    returnResults( result, res);
  }).catch(next);
}

function beforeSaveEntity(entityInfo) {
  // exclude lookups from save.  should this throw an error instead?
  var excludes = ['AddressType', 'PhoneNumberType', 'RateType', 'State'];
  var name = entityInfo.entityType.shortName;
  if (excludes.indexOf(name) >= 0) {
    return false;
  } 
  return true;
}

function beforeSaveEntities(saveMap) {
  var tag = this.saveOptions.tag;

  // crude example of server-side validation
  var staff = saveMap.getEntityInfosOfType("StaffingResource");
  staff.forEach(function(info) {
    if (info.entityAspect.entityState != "Deleted") {
      if (info.entity.FirstName.toLowerCase().indexOf("error") === 0) {
        saveMap.addEntityError(info, "Bad Data", "Cannot contain the word 'error'!", "FirstName");
      }
    }
  });
}
