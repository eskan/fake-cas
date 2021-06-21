const path = require('path')

module.exports = {
    mode: process.env.NODE_ENV === "development" ? "development" : "production",
    target: 'node',
    entry: {
        app: './server.js'
    },
    output: {
        filename: '[name].js',
    }
};
