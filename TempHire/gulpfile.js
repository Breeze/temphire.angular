/// <binding AfterBuild='default' />
var gulp    = require('gulp');
var shell = require('gulp-shell');
var watch = require('gulp-watch');
var path = require('path');

var clientDir = '.';

// build client code
gulp.task('build',
  shell.task(['npm run build:prod'], { cwd: clientDir })
);

gulp.task('default', ['build'], function() {

});
