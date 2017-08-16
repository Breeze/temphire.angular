const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');

const entryPoints = ['manifest', 'vendor', 'app'];

module.exports = {
    devtool: 'source-map',

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

    plugins: [
        new CleanWebpackPlugin(['dist/*.*']),

        new webpack.optimize.ModuleConcatenationPlugin(),

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
