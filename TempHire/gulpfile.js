/// <binding AfterBuild='default' />
const { task } = require('gulp-shell');

const clientDir = '.';

// build client code
function build() {
  return task(['npm run build:prod'], { cwd: clientDir })();
}

exports.default = build;
