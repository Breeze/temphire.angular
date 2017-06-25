const path = require('path');
const webpack = require('webpack');
const Merge = require('webpack-merge');
const CommonConfig = require('./webpack.common.js');

module.exports = function (env) {
    return Merge(CommonConfig, {
        plugins: [
            new webpack.LoaderOptionsPlugin({
                minimize: true,
                debug: false
            }),

            new webpack.DefinePlugin({
                'process.env': {
                    'NODE_ENV': JSON.stringify('production')
                }
            }),
            
            new webpack.optimize.UglifyJsPlugin({ // https://github.com/angular/angular/issues/10618
                sourceMap: true,
                compress: { warnings: false },
                mangle: { keep_fnames: true }
            })
        ]
    })
}