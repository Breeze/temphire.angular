var gulp    = require('gulp');
var shell = require('gulp-shell');
var install = require('gulp-install');
var path = require('path');

var clientDir = path.join('.', 'TempHire');
var serverDir = path.join('.', 'Express');

// client npm install
gulp.task('client-install', function() {
  return gulp.src(mapPath(clientDir, ['package.json']))
      .pipe(install());
});

// server npm install
gulp.task('server-install', function() {
  return gulp.src(mapPath(serverDir, ['package.json']))
      .pipe(install());
});

// build client code
gulp.task('client-build', ['client-install'],
  shell.task(['gulp'], { cwd: clientDir })
);

// run server
gulp.task('run', ['server-install', 'client-build'],
  shell.task('node server', { cwd: serverDir })
);

gulp.task('default', ['run'], function() {

});

function mapPath(dir, filenames) {
  return filenames.map(function(filename) {
    return path.join(dir, filename);
  });
};
