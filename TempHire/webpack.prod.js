const Merge = require('webpack-merge');
const CommonConfig = require('./webpack.common.js');
const ngtools = require('@ngtools/webpack');

module.exports = function () {
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