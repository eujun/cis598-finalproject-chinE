const express = require('express');
const bodyParser = require('body-parser');
const _ = require('lodash');
const {ObjectID} = require('mongodb');
const hbs = require('hbs');
const fs = require('fs');

var {mongoose} = require('./db/mongoose.js');
var {User} = require('./models/user.js');
var {authenticate} = require('./middleware/authenticate.js');

const port = process.env.PORT || 3000;
var app = express();

app.use(bodyParser.json());
hbs.registerPartials(__dirname + '/views/partials');
app.set('view engine', 'hbs');

app.use((req, res, next) => {
  var now = new Date().toString();
  var log = `${now}: ${req.method} ${req.url}`;

  console.log(log);
  fs.appendFile('server.log', log + '\n', (err) => {
    if (err) {
      console.log("Unable to append to server.log");
    }
  });
  next();
});

// app.use(express.static(__dirname + '/public'));

// hbs.registerHelper('getCurrentYear', () => {
//   return new Date().getFullYear();
// });
//
// hbs.registerHelper('screamIt', (text) => {
//   return text.toUpperCase()
// });



app.listen(port, () => {
  console.log(`Server is up on port ${port}`);
});
