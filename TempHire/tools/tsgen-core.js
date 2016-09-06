var fs = require('fs');
var path = require('path');
var breeze = require('breeze-client');
var handlebars = require('handlebars');
var _ = require('lodash');

module.exports = {
  generate: generate
};

// config structure
//   inputFileName:
//   outputFolder:
//   camelCase:
//   baseClassFileName:
//   sourceFilesFolder:
function generate(config) {
  config.outputFolder = config.outputFolder || '.';
  config.sourceFilesFolder = config.sourceFilesFolder || config.outputFolder;
  if (config.camelCase) {
    breeze.NamingConvention.camelCase.setAsDefault();
  }
  console.log('Generating typescript classes...');
  console.log('Input: ' + path.resolve(config.inputFileName));
  console.log('Source: ' + path.resolve(config.sourceFilesFolder));
  console.log('Output: ' + path.resolve(config.outputFolder));
  console.log('CamelCase: ' + !!config.camelCase);

  // Load metadata.
  var metadata = fs.readFileSync(config.inputFileName, 'utf8');
  //console.log(metadata);

  // Import metadata
  var metadataStore = breeze.MetadataStore.importMetadata(metadata);
  processRawMetadata(metadataStore, config);
  //console.log(metadataStore.getEntityTypes());

  // Load and compile typescript template
  var templateFilename = path.resolve(__dirname, 'entity.template.txt');
  var template = fs.readFileSync(templateFilename, 'utf8');
  var compiledTemplate = handlebars.compile(template);

  // Generate typescript classes for each entity
  metadataStore.getEntityTypes().forEach(function (entityType) {
    var ts = compiledTemplate(entityType);

    // Don't overwrite file if nothing has changed.
    if (entityType.originalFileContent !== ts) {
      fs.writeFileSync(entityType.filename, ts, 'utf8');
    } else {
      console.log(entityType.sourceFilename + " hasn't changed. Skipping...");
    }
  });

  // Generate registration helper
  metadataStore.generatedAt = new Date();
  metadataStore.namespace = metadataStore.getEntityTypes()[0].namespace;
  templateFilename = path.resolve(__dirname, 'register.template.txt');
  template = fs.readFileSync(templateFilename, 'utf8');
  compiledTemplate = handlebars.compile(template);
  var ts = compiledTemplate(metadataStore);

  var filename = fileNameCase('RegistrationHelper', config) + '.ts';
  var regHelperSourceFilename = path.resolve(config.sourceFilesFolder, filename);
  var regHelperFilename = path.resolve(config.outputFolder, filename);
  var regHelperOriginalContent;
  if (fs.existsSync(regHelperSourceFilename)) {
    regHelperOriginalContent = fs.readFileSync(regHelperSourceFilename, 'utf8');
  }
  // Don't overwrite file if nothing has changed.
  if (regHelperOriginalContent !== ts) {
    fs.writeFileSync(regHelperFilename, ts, 'utf8');
  } else {
    console.log(regHelperSourceFilename + " hasn't changed. Skipping...");
  }

  // Generate entity model
  metadataStore.generatedAt = new Date();
  metadataStore.namespace = metadataStore.getEntityTypes()[0].namespace;
  templateFilename = path.resolve(__dirname, 'entityModel.template.txt');
  template = fs.readFileSync(templateFilename, 'utf8');
  compiledTemplate = handlebars.compile(template);
  var ts = compiledTemplate(metadataStore);

  var filename = fileNameCase('EntityModel', config) + '.ts';
  var entityModelSourceFilename = path.resolve(config.sourceFilesFolder, filename);
  var entityModelFilename = path.resolve(config.outputFolder, filename);
  var entityModelOriginalContent;
  if (fs.existsSync(entityModelSourceFilename)) {
    entityModelOriginalContent = fs.readFileSync(entityModelSourceFilename, 'utf8');
  }
  // Don't overwrite file if nothing has changed.
  if (entityModelOriginalContent !== ts) {
    fs.writeFileSync(entityModelFilename, ts, 'utf8');
  } else {
    console.log(entityModelSourceFilename + " hasn't changed. Skipping...");
  }  

  // Generate metadata.ts
  templateFilename = path.resolve(__dirname, 'metadata.template.txt');
  template = fs.readFileSync(templateFilename, 'utf8');
  compiledTemplate = handlebars.compile(template);
  var ts = compiledTemplate({metadata: metadata});

  var filename = fileNameCase('Metadata', config) + '.ts';
  var metadataSourceFilename = path.resolve(config.sourceFilesFolder, filename);
  var metadataFilename = path.resolve(config.outputFolder, filename);
  var metadataOriginalContent;
  if (fs.existsSync(metadataSourceFilename)) {
    metadataOriginalContent = fs.readFileSync(metadataSourceFilename, 'utf8');
  }
  // Don't overwrite file if nothing has changed.
  if (metadataOriginalContent !== ts) {
    fs.writeFileSync(metadataFilename, ts, 'utf8');
  } else {
    console.log(metadataSourceFilename + " hasn't changed. Skipping...");
  }
}

function processRawMetadata(metadataStore, config) {
  var entityTypes = metadataStore.getEntityTypes();
  metadataStore.modules = entityTypes.map(function (entityType) {
    return { entityType: entityType, path: entityType.shortName, moduleName: fileNameCase(entityType.shortName, config) };
  });

  var baseClass = config.baseClassName;
  if (baseClass) {
    console.log('Injected base class: ' + baseClass);
  }

  entityTypes.forEach(function (entityType) {
    if (!entityType.getProperties) {
      entityType.getProperties = function () {
        return entityType.dataProperties;
      }
    }
    var properties = entityType.getProperties().filter(function (property) {
      return !property.baseProperty;
    });
    entityType.properties = properties.map(function (property) {
      return { name: property.name, dataType: convertDataType(metadataStore, property) };
    });
    if (entityType.baseEntityType) {
      // entityType.baseClass = entityType.baseEntityType.namespace + '.' + entityType.baseEntityType.shortName;
      entityType.baseClass = entityType.baseEntityType.shortName;
    } else if (baseClass) {
      entityType.baseClass = baseClass;
      //entityType.references.push({
      //  entityType: null,
      //  path: path.relative(config.sourceFilesFolder, baseClassFileName.substr(0, baseClassFileName.length - 3))
      //});
    }
    entityType.baseClassModuleName = fileNameCase(entityType.baseClass, config);
    entityType.imports = metadataStore.modules.filter(function (module) {
      // baseClass is already imported in the template
      if (module.entityType === entityType || module.path === entityType.baseClass) {
        return false;
      }

      return hasDependency(entityType, module.entityType);
    });
    entityType.generatedAt = new Date();

    // Set output filename path
    entityType.filename = path.resolve(config.outputFolder, fileNameCase(entityType.shortName, config) + '.ts');

    // Extract custom code from existing file
    entityType.sourceFilename = path.resolve(config.sourceFilesFolder, fileNameCase(entityType.shortName, config) + '.ts');
    if (fs.existsSync(entityType.sourceFilename)) {
      var ts = fs.readFileSync(entityType.sourceFilename, 'utf8');
      entityType.originalFileContent = ts;

      entityType.codeimport = extractSection(ts, 'code-import', entityType.shortName);
      // entityType.codereference = extractSection(ts, 'code-reference');
      entityType.code = extractSection(ts, 'code', entityType.shortName);

      // Extract optional initializer function
      var matches = entityType.code.match('\/\/\/[ \t]*\[[ \t]*Initializer[ \t]*\][ \t\r\n]*(public)?[ \t\r\n]+static[ \t\r\n]+([0-9|A-Z|a-z]+)');
      if (matches && matches.length != 0) {
        entityType.initializerFn = matches[2];
      } else {
        entityType.initializerFn = 'initializer';
        entityType.generateInitializer = true;
      }

      if (entityType.initializerFn) {
        console.log('Initializer function "' + entityType.initializerFn + '" discovered for entity type: ' + entityType.shortName);
      } else {
        console.log('No initializer function discovered for entity type: ' + entityType.shortName);
      }
    }
  });
}

function extractSection(content, tag, sourceFileName) {
  var matches = content.match('\/\/\/[ \t]*<' + tag + '>.*');
  if (matches && matches.length !== 0) {
    var startTag = matches[0];
    matches = content.match('\/\/\/[ \t]*<\/' + tag + '>.*');
    if (!matches || matches.length === 0) {
      throw new Error('Expected </' + tag + '> closing tag. ->: ' + sourceFileName);
    }
    var endTag = matches[0];

    return content.substring(content.indexOf(startTag) + startTag.length, content.indexOf(endTag)).trim();
  }

  return null;
}

function convertDataType(metadataStore, property) {
  if (property.isNavigationProperty) {
    // var navigationType = property.entityType.namespace + '.' + property.entityType.shortName;
    var navigationType = property.entityType.shortName;
    if (property.isScalar) {
      return navigationType;
    }
    return navigationType + '[]';
  }

  if (property.isComplexProperty) {
    var complexType = getEntityType(metadataStore, property.complexTypeName);
    // return complexType.namespace + '.' + complexType.shortName;
    if (!complexType) console.log("Cannot find complex type " + property.complexTypeName);
    return complexType.shortName;
  }

  var dataType = property.dataType;
  if (dataType.isNumeric) {
    return 'number';
  }
  if (dataType === breeze.DataType.Boolean) {
    return 'boolean';
  }
  if (dataType === breeze.DataType.DateTime || dataType === breeze.DataType.DateTimeOffset || dataType === breeze.DataType.Time) {
    return 'Date';
  }
  if (dataType === breeze.DataType.String || dataType === breeze.DataType.Guid) {
    return 'string';
  }
  return 'any';
}

function getEntityType(metadataStore, name) {
  var types = metadataStore.getEntityTypes().filter(function (entityType) {
    return entityType.name === name;
  });

  if (types.length === 1)
    return types[0];

  return null;
}

function hasDependency(entityType, dependentEntityType) {
  var complexMatches = entityType.dataProperties.filter(function (property) {
    return !property.isInherited && property.isComplexProperty && property.complexTypeName === dependentEntityType.name;
  });

  if (complexMatches.length !== 0) {
    return true;
  }

  return entityType.navigationProperties.filter(function (property) {
    return !property.isInherited && property.entityType === dependentEntityType;
  }).length !== 0
}

function fileNameCase(filename, config) {
  if (config.kebabCaseFileNames) {
    if (filename.startsWith("I")) {
      return "i" + _.kebabCase(filename.substring(1)).toLowerCase();
    }
    return _.kebabCase(filename).toLowerCase();
  }

  return filename;
}


