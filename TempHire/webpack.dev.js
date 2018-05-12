const webpack = require('webpack');
const Merge = require('webpack-merge');
const CommonConfig = require('./webpack.common.js');

module.exports = function (env) {
    return Merge(CommonConfig, {

        entry: {
            'app': './app/main.ts',
            'vendor': [
                'tslib',
                'lodash-es',
                'rxjs',
                'breeze-client',
                'breeze-client/breeze.dataService.webApi',
                'breeze-client/breeze.modelLibrary.backingStore',
                'breeze-client/breeze.uriBuilder.json',
                'breeze-client/breeze.uriBuilder.odata',
                'breeze-bridge2-angular',
                '@angular/common',
                '@angular/compiler',
                '@angular/core',
                '@angular/forms',
                '@angular/platform-browser-dynamic',
                '@angular/router'
            ],
        },

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