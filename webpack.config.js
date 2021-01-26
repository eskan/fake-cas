const path = require('path')

module.exports = {
    target: 'node',
    entry: {
        app: './server.ts'
    },
    output: {
        filename: '[name].js',
    },
    module: {
        rules: [{
            test: /\.ts/,
            use: {
              loader: "ts-loader",
            }
          }
        ]
      },
};