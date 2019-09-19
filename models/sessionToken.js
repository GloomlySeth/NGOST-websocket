
var mongoose = require('mongoose');

module.exports = mongoose.model('session',{
    id: String,
    token: String,
});