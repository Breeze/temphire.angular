// Import metadata
var fs = require('fs');
var breeze = require("breeze-client");
var filenameIn = process.argv[2];  // '..\\Fng.Space.Data.EF.SpaceDbContext.csdl.json';

var metadata = fs.readFileSync(filenameIn, 'utf8');

var metadataStore = new breeze.MetadataStore({ namingConvention: breeze.NamingConvention.camelCase });
metadataStore.importMetadata(metadata);
var exportedMetadata = metadataStore.exportMetadata();

if (process.argv.length > 3) {
    filenameOut = process.argv[3]; // '..\\Fng.Space.Data.EF.SpaceDbContext.native.json';
    fs.writeFileSync(filenameOut, exportedMetadata);
} else {
    console.log(exportedMetadata);
}
