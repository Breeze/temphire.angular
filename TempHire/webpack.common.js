const path = require('path');
const webpack = require('webpack');
const CommonsChunkPlugin = webpack.optimize.CommonsChunkPlugin;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const ngtools = require('@ngtools/webpack');

const entryPoints = ['manifest', 'vendor', 'app'];

module.exports = {
    devtool: 'source-map',

    entry: {
        'app': './app/main-aot.ts'
    },

    output: {
        path: __dirname + '/dist/',
        publicPath: 'dist/',
        filename: '[name].[hash].js',
        sourceMapFilename: '[file].map',
    },

    externals: {
        jquery: 'jQuery'
    },

    resolve: {
        modules: [
            path.join(__dirname, 'app'),
            'node_modules'
        ],
        extensions: ['.ts', '.js', '.html'],
        alias: {
            'breeze-client$': path.resolve(__dirname, 'node_modules', 'breeze-client', 'breeze.base.debug.js')
        }
    },

    module: {
        loaders: [
            {
                test: /\.ts$/,
                loader: '@ngtools/webpack'
            },
            {
                test: /\.html$/,
                loader: 'raw-loader'
            }
        ]
    },

    plugins: [
        new CleanWebpackPlugin(['dist/*.*']),

        new ngtools.AotPlugin({
            tsConfigPath: './tsconfig-aot.json'
        }),

        new webpack.optimize.CommonsChunkPlugin({
            name: 'vendor',
            minChunks: (m) => /node_modules/.test(m.context)
        }),
        new webpack.optimize.CommonsChunkPlugin({
            name: 'manifest',
            minChunks: Infinity
        }),

        new HtmlWebpackPlugin({
            filename: '../index.html',
            template: 'index.ejs',
            inject: true,
            hash: false,
            chunksSortMode: function sort(left, right) {
                let leftIndex = entryPoints.indexOf(left.names[0]);
                let rightindex = entryPoints.indexOf(right.names[0]);
                if (leftIndex > rightindex) {
                    return 1;
                }
                else if (leftIndex < rightindex) {
                    return -1;
                }
                else {
                    return 0;
                }
            }
        })
    ]
};
