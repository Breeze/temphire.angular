/**
 * Script to import data from the sql file into the sqlite database
 */
var fs = require('fs');
var sqlite3 = require('sqlite3').verbose();

var filename = 'temphire.sqlite.import.sql';
var dbname = 'temphire.db';
var splitre = /;[\r\n]+/g;

if (fs.existsSync(dbname)) {
    console.log("Database " + dbname + " already exists!  Please remove and try again.");
    return;
}

console.log('Creating/opening sqlite3 database: ' + dbname);
var db = new sqlite3.Database(dbname);

console.log('Importing from file: ' + filename);

fs.readFile(filename, 'utf8', function (err,data) {
    if (err) {
        return console.log(err);
    }
    var cmds = data.split(splitre);
    console.log('Total commands: ' + cmds.length);
    runCommands(cmds);
});

function runCommands(cmds) {
    db.serialize(function() {

        cmds.forEach(function(cmd) {
            console.log(cmd + '\n\n\n');
            db.run(cmd, [], function(err) {
                if (err) {
                    console.log(err);
                }
            });
        });
    });
    db.close();
}
    