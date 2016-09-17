/**
 * Convert csdl metadata to native by importing and exporting
 * TODO: convert "name" to "nameOnServer", "foreignKeyNames" to "foreignKeyNamesOnServer" etc.
 */
var fs = require('fs');
var path = require('path');
var breeze = require('breeze-client');

var args = process.argv.slice(2);
if (args.length != 2) {
    return console.log('Usage: node convert.js [csdlfile] [outfile]');
}

var csdlfile = args[0];
var outfile = args[1];

// Load metadata.
var metadata = fs.readFileSync(csdlfile, 'utf8');
//console.log(metadata);

// Import metadata
var metadataStore = breeze.MetadataStore.importMetadata(metadata);

var out = metadataStore.exportMetadata();

fs.writeFile(outfile, out, function (err) {
    if (err) return console.log(err);
});

  