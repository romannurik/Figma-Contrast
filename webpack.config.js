const process = require('process');
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  // devtool: '', // force not using 'eval' which doesn't recognize __html__ and other globals
  entry: {
    main: './src/main.entry.ts',
  },
  performance: { hints: false },
  output: {
    filename: '[name].js',
    path: path.join(process.cwd(), './dist'),
  },
  module: {
    rules: [
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
          'style-loader',
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
      {
        from: './src/manifest.json',
        to: '.',
        transform: buffer => buffer.toString('utf8')
            .replace(/%%(\w+)%%/g, (_, v) => process.env[v] || ''),
      },
    ]),
  ],
};
