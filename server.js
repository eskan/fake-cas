import bodyParser from 'body-parser';
import uuid from 'node-uuid';
import express from 'express';

var app = express();

var tickets={};

app.get('/login', function (req, res) {
  res.sendFile(__dirname + '/form.html');
});

app.post('/login', bodyParser.urlencoded(),function (req, res) {
  var ticket = "ST-" + uuid.v1();
  tickets[ticket] = req.body.login;
  console.log(req.body, req.query);
  res.writeHead(302, {'Location': `${req.query.service}?ticket=${ticket}`});
  res.end();
});

app.get('/validate', function (req, res) {
  if(tickets[req.query.ticket]) {
    res.send(`yes\n${tickets[req.query.ticket]}`);
    delete tickets[req.query.ticket];
  } else {
    res.send('no');
  }
  res.end();
});

app.listen(3000, function () {
  console.log('Fake-cas available on http://localhost:3000');
});
