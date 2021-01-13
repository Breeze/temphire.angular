const { series, parallel, src } = require('gulp');
const { task } = require('gulp-shell');
const install = require('gulp-install');
const path = require('path');

const clientDir = path.join('.', 'TempHire');
const serverDir = path.join('.', 'Express');

// client npm install
function clientInstall() {
  return src(mapPath(clientDir, ['package.json']))
      .pipe(install());
}

// server npm install
function serverInstall() {
  return src(mapPath(serverDir, ['package.json']))
      .pipe(install());
}

// build client code
function clientBuild() {
  return task(['gulp'], { cwd: clientDir })();
}

// run server
function run() {
  return task('node server', { cwd: serverDir })();
}

exports.default = series(
  parallel(
    serverInstall,
    series(
      clientInstall,
      clientBuild
    )
  ),
  run
);

function mapPath(dir, filenames) {
  return filenames.map(function(filename) {
    return path.join(dir, filename);
  });
};
