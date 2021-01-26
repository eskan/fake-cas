import bodyParser from 'body-parser';
import uuid from 'node-uuid';
import express from 'express';
import cookieParser from 'cookie-parser'

var app = express();
app.use(cookieParser());

var tickets:any = {};
var cookies:any = {};

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
      res.sendFile(process.cwd() + '/already.html');
    }
  } else {
    res.sendFile(process.cwd() + '/form.html');
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
    res.sendFile(process.cwd() + '/already.html');
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
  const ticket = req.query.ticket as string;
  if (ticket && tickets[ticket]) {
    res.send(`yes\n${tickets[ticket]}`);
    delete tickets[ticket];
  } else {
    res.send('no');
  }
  res.end();
});

app.listen( process.env.PORT || 3000, function() {
  console.log(`Fake-cas available on http://localhost:${process.env.PORT || 3000}`);
});
