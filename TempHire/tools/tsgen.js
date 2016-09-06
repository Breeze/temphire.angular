var tsGen = require('./tsgen-core');

tsGen.generate({
    inputFileName: './metadata.json',
    outputFolder: './app/core/entities',
    camelCase: true,
    kebabCaseFileNames: true,
    baseClassName: 'EntityBase'
});
//     baseClassName: 'EntityBase'

