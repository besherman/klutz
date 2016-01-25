var webpack = require('webpack');
var path = require('path');

module.exports = {
  entry: {
    'app': './src/app.ts',
    'vendor': './src/vendor.ts'
  },
  output: {
    path: "./dist",
    filename: "bundle.js"
  },

  devtool: "source-map",

  plugins: [
    new webpack.optimize.CommonsChunkPlugin('vendor', 'vendor.bundle.js')
  ],

  resolve: {
    extensions: ['', '.ts', '.js']
  },

  //preLoaders: [
  //  {test: /\.js$/, loader: 'source-map-loader'}
  //],

  module: {
    loaders: [
      { test: /\.ts$/, loader: 'ts-loader' },
    ],
    noParse: [ path.join(__dirname, 'node_modules', 'angular2', 'bundles') ]
  },

  devServer: {
      historyApiFallback: true
  }
};
