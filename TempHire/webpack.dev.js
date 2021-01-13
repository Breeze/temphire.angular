const { merge } = require('webpack-merge');
const CommonConfig = require('./webpack.common.js');

module.exports = function () {
    return merge(CommonConfig, {

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
                            attributes: false
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