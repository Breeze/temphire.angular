const Merge = require('webpack-merge');
const CommonConfig = require('./webpack.common.js');

module.exports = function (env) {
    return Merge(CommonConfig);
}