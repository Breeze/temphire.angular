var fs = require('fs');
var sqlite3 = require('sqlite3').verbose();

var args = process.argv.slice(2);
if (args.length != 2) {
    return console.log('Usage: node query.js [dbfilename] "[query string in quotes]"');
}

var dbname = args[0];
var query = args[1];

if (!fs.existsSync(dbname)) {
    return console.log("Database " + dbname + " does not exist!");
}

var db = new sqlite3.Database(dbname);

db.each(query, function (err, row) {
    console.log(row || err);
});

db.close();

    