import bodyParser from 'body-parser';
import uuid from 'node-uuid';
import express from 'express';
import cookieParser from 'cookie-parser'

var app = express();
app.use(cookieParser());

var tickets = {};
var cookies = {};

app.get('/login', function(req, res) {
  if (req.cookies['fake-cas'] && cookies[req.cookies['fake-cas']]) {
    if (req.query.service) {
      var ticket = "ST-" + uuid.v1();
      tickets[ticket] = cookies[req.cookies['fake-cas']];
      res.writeHead(302, {
        'Location': `${req.query.service}?ticket=${ticket}`
      });
      res.end();
    } else {
      res.sendFile(__dirname + '/already.html');
    }
  } else {
    res.sendFile(__dirname + '/form.html');
  }
});

app.post('/login', bodyParser.urlencoded(), function(req, res) {
  var cookie = uuid.v1();
  cookies[cookie] = req.body.login;
  res.cookie('fake-cas', cookie);
  if (req.query.service) {
    var ticket = "ST-" + uuid.v1();
    tickets[ticket] = req.body.login;
    res.writeHead(302, {
      'Location': `${req.query.service}?ticket=${ticket}`
    });
    res.end();
  } else {
    res.sendFile(__dirname + '/already.html');
  }
});

app.use('/logout', function(req, res) {
  if (req.cookies['fake-cas'] && cookies[req.cookies['fake-cas']]) {
    delete cookies[req.cookies['fake-cas']];
  }
  res.cookie('fake-cas', '');
  res.writeHead(302, {
    'Location': '/login'
  });
  res.end();
});

app.get('/validate', function(req, res) {
  if (tickets[req.query.ticket]) {
    res.send(`yes\n${tickets[req.query.ticket]}`);
    delete tickets[req.query.ticket];
  } else {
    res.send('no');
  }
  res.end();
});

app.listen( process.env.PORT || 3000, function() {
  console.log(`Fake-cas available on http://localhost:${process.env.PORT || 3000}`);
});
