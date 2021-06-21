const path = require('path')

module.exports = {
    mode: process.env.NODE_ENV === "development" ? "development" : "production",
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
