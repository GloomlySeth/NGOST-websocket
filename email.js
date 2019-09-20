var email 	= require('emailjs');
var pass = require('fs').readFileSync('password_mail.txt', 'utf8');
var server 	= email.server.connect({
    user:    "auditoria612.2@gmail.com",
    password: pass,
    host:    "smtp.gmail.com",
    ssl:     true,
    port: 465
});

// send the message and get a callback with an error or details of the message that was sent


module.exports = {
    sendMessage: function (email) {
        server.send({
            text:    "Hi! I hope email work!",
            from:    "auditoria612.2@gmail.com",
            to:      "qblr11@gmail.com",
            subject: "hello fella"
        }, function(err, message) { console.log(err || message); });
    }

}