const process = require('process');
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  // devtool: '', // force not using 'eval' which doesn't recognize __html__ and other globals
  entry: {
    main: './src/main.entry.ts',
  },
  output: {
    filename: '[name].js',
    path: path.join(process.cwd(), './dist'),
  },
  module: {
    rules: [
      // Embedded JS/TS
      {
        test: /\.embedded\.(j|t)sx?$/,
        exclude: /node_modules/,
        use: [
          require.resolve('./embedded-bundle-loader'),
        ]
      },
      // JS and TS
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: [
          'babel-loader',
        ]
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          'ts-loader'
        ]
      },
      // CSS and SCSS
      {
        test: /\.s?css$/,
        use: [
          'css-loader',
          'sass-loader',
        ]
      },
      // HTML
      {
        test: /\.html$/,
        use: [
          {
            loader: 'html-loader',
            options: {
              interpolate: true,
            },
          }
        ],
      },
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.scss', '.html',],
  },
  plugins: [
    new CopyPlugin([
      { from: './src/manifest.json', to: '.' },
    ]),
  ],
};
