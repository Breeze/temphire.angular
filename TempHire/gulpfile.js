/// <binding AfterBuild='default' />
var gulp    = require('gulp');
var shell = require('gulp-shell');
var watch = require('gulp-watch');
var path = require('path');

var clientDir = '.';
var ngc = path.join('.', 'node_modules', '.bin', 'ngc');
var rollup = path.join('.', 'node_modules', '.bin', 'rollup');

// build client code
gulp.task('build',
  shell.task([ngc + ' -p tsconfig-aot.json'], { cwd: clientDir })
);

// tree shaking
gulp.task('rollup', ['build'],
  shell.task([rollup + ' -c rollup.js'], { cwd: clientDir })
)

// watch and build
gulp.task('watch', function() {
  var basePath = path.join(clientDir, 'app', '**');
  var tsglob = path.join(basePath, '*.ts');
  var htmlglob = path.join(basePath, '*.html');

  gulp.watch([tsglob, htmlglob], ['rollup']);
});

gulp.task('default', ['rollup'], function() {

});
