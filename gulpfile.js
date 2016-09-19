var gulp    = require('gulp');
var shell = require('gulp-shell');
var install = require("gulp-install");

var clientDir = './TempHire/';
var serverDir = './Express/';

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
gulp.task('build', ['client-install', 'server-install'],
  shell.task(['tsc'], { cwd: clientDir })
);

// run server
gulp.task('run', ['build'],
  shell.task('node server', { cwd: serverDir })
);

gulp.task('default', ['run'], function() {

});

function mapPath(dir, fileNames) {
  return fileNames.map(function(fileName) {
    return dir + fileName;
  });
};
