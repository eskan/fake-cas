const path = require('path')

module.exports = {
    target: 'node',
    entry: {
        app: './server.js'
    },
    output: {
        filename: '[name].js',
    }
};