const path = require('path');
const webpack = require('webpack');
const Merge = require('webpack-merge');
const CommonConfig = require('./webpack.common.js');
const ngtools = require('@ngtools/webpack');
const CommonsChunkPlugin = webpack.optimize.CommonsChunkPlugin;

module.exports = function (env) {
    return Merge(CommonConfig, {
        entry: {
            'app': './app/main.ts'
        },

        module: {
            loaders: [
                {
                    test: /(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/,
                    loader: '@ngtools/webpack'
                },
                {
                    test: /\.html$/,
                    loader: 'raw-loader'
                }
            ]
        },

        plugins: [

            new ngtools.AngularCompilerPlugin({
                tsConfigPath: './tsconfig-aot.json'
            }),

            new CommonsChunkPlugin({
                name: 'vendor',
                minChunks: (m) => /node_modules/.test(m.context)
            }),
            new CommonsChunkPlugin({
                name: 'manifest',
                minChunks: Infinity
            }),

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
                sourceMap: true
            })
        ]
    })
}