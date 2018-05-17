const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const path = require('path');
const webpack = require('webpack');
const Merge = require('webpack-merge');
const CommonConfig = require('./webpack.common.js');
const ngtools = require('@ngtools/webpack');

module.exports = function (env) {
    return Merge(CommonConfig, {

        mode: 'production',

        module: {
            rules: [
                {
                    test: /(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/,
                    loader: '@ngtools/webpack'
                },
                {
                    test: /\.html$/,
                    use: [{
                        loader: 'raw-loader'
                    }]
                }
            ]
        },

        plugins: [
            new ngtools.AngularCompilerPlugin({
                tsConfigPath: './tsconfig-aot.json'
            })
        ],

        optimization: {
            minimize: true,

            minimizer: [new UglifyJsPlugin({ // https://github.com/angular/angular/issues/10618
                sourceMap: true
            })],

            splitChunks: {
                cacheGroups: {
                    commons: {
                        test: /[\\/]node_modules[\\/]/,
                        name: "vendor",
                        chunks: "all"
                    }
                }
            }
        }
    });
}