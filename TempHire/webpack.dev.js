const Merge = require('webpack-merge');
const CommonConfig = require('./webpack.common.js');

module.exports = function () {
    return Merge(CommonConfig, {

        mode: 'development',

        module: {
            rules: [
                {
                    test: /\.ts$/,
                    use: [{
                        loader: 'ts-loader'
                    }, {
                        loader: 'angular2-template-loader'
                    }],
                    exclude: [/node_modules/]
                },
                {
                    test: /\.html$/,
                    use: [{
                        loader: 'html-loader',

                        options: {
                            attrs: false,
                            removeAttributeQuotes: true,
                            caseSensitive: true
                        }
                    }]
                }
            ]
        },

        optimization: {
            minimize: false
        }

    });
}