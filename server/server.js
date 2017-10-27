const express = require('express');
const bodyParser = require('body-parser');
const _ = require('lodash');
const {ObjectID} = require('mongodb');
const hbs = require('hbs');
const fs = require('fs');
const session = require('express-session');
const formidable = require('formidable');

var {mongoose} = require('./db/mongoose.js');
var {User} = require('./models/user.js');
var {authenticate} = require('./middleware/authenticate.js');
var {checkSignIn} = require('./middleware/authenticate.js');
const port = process.env.PORT || 3000;
var app = express();

app.use(bodyParser.json());

app.set('trust proxy', 1)
app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

hbs.registerPartials(__dirname + './../views/partials');
app.set('view engine', 'hbs');
hbs.registerHelper('getCurrentYear', () => {
  return new Date().getFullYear();
});

//Logging all request to server
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

//GET /signup
app.get('/signup', (req,res) => {
  res.render('signup.hbs', {
    pageTitle: 'Sign Up Page'
  });
});

// POST /signup
app.post('/signup', (req, res) => {
  //var body = _.pick(req.body, ['username', 'password']);
  var form = new formidable.IncomingForm();
  form.parse(req,function(err,fields,files) {
    var user = new User({
      username: fields.username,
      password: fields.password
    });
    user.save().then(() => {
      //res.send(user);
      req.session.user = user;
      console.log(req.session.user);
      res.redirect('/profile');
    }).catch((e) => {
      res.status(400).send(e);
    })
  });
});

// GET /profile
app.get('/profile', checkSignIn, (req,res) => {
  res.render('profile.hbs' ,{
    pageTitle: 'Profile',
    username: req.session.user.username,
    name: req.session.user.name,
    phone: req.session.user.phone,
    email: req.session.user.email
  });
});

//GET /login2
app.get('/login2', (req, res) => {
   res.render('login.hbs', {
     pageTitle: 'Login Page'
   });
});

//POST /login2
app.post('/login2', (req,res) => {
  var form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    User.findByCredentials(fields.username, fields.password).then((user) => {
      req.session.user = user;
      console.log(req.session.user);
      res.redirect('/profile');
    }).catch((e) => {
      res.status(400).send(e);
    });
  });
});

//GET /logout
app.get('/logout', checkSignIn, (req, res) => {
  req.session.destroy(() => {
    console.log("User logged out.");
  });
  res.redirect('/login2');
});

//redirects to login page if users tries to access profile without logging in first
app.use('/profile', (err, req, res, next) => {
  console.log(err);
   //User should be authenticated! Redirect him to log in.
  res.redirect('/login2');
});

//GET /editProfile
app.get('/editProfile', checkSignIn, (req, res) => {
  res.render('editProfile.hbs', {
    pageTitle: 'Edit Profile',
    name: req.session.user.name,
    phone: req.session.user.phone,
    email: req.session.user.email
  });
});

//POST /editProfile
app.post('/editProfile', checkSignIn, (req,res) => {
  var form = new formidable.IncomingForm();
  var id = req.session.user._id;

  if (!ObjectID.isValid(id)) {
    return res.status(404).send("Invalid ID");
  }
  form.parse(req, (err, fields, files) => {
    User.findByIdAndUpdate(id, {
      name: fields.name,
      phone: fields.phone,
      email: fields.email
    }, {new: true}).then((user) =>{
      if(!user) {
        return res.status(404).send("ID not found.");
      }
      req.session.user = user;
      res.redirect('/profile');
    }).catch((e) => {
      res.status(400).send(e);
    });
  });
});

// GET /users/:id       visits profile pages of other users
app.get('/users/:id', checkSignIn, (req,res) => {
  var id = req.params.id;
  if (!ObjectID.isValid(id)) {
    return res.status(404).send("Invalid ID");
  }
  User.findById(id).then((user) => {
    if(!user) {
      return res.status(404).send("ID not found.");
    }
    res.render('viewProfile.hbs', {
      pageTitle: 'View Profile',
      name: user.name,
      phone: user.phone,
      email: user.email,
      id: id,
      rating: Math.round(user.rating * 100) / 100,
      ratings: user.ratings
    });
  });
});

// GET /rate/:id
app.get('/rate/:id', checkSignIn, (req,res) => {
  var id = req.params.id;
  if (!ObjectID.isValid(req.params.id)) {
    return res.status(404).send("Invalid ID");
  }
  User.findById(id).then((user) => {
    if(!user) {
      return res.status(404).send("ID not found.");
    }
    res.render('rate.hbs', {
      pageTitle: 'Rating Page',
      id: id,
      name: user.name
    });
  });
});

// POST /rate/:id
app.post('/rate/:id', checkSignIn, (req,res) => {
  var viewer = req.session.user;
  var id = req.params.id;
  var form = new formidable.IncomingForm();
  if (!ObjectID.isValid(id)) {
    return res.status(404).send("Invalid ID");
  }
  form.parse(req, (err, fields, files) => {
    User.findById(id).then((user) => {
      if(!user) {
        return res.status(404).send("ID not found.");
      }
      user.updateRatings(fields,viewer);
      user.calculateRatings();
      res.redirect('/users/' + id);
    }).catch((e) => {
      res.send(e);
    });
  });
});

/////////////////////////////////////////////////////////////////

//GET /users/me
app.get('/users/me', authenticate, (req,res) => {
  res.send(req.user);
});

//POST /login
app.post('/login', (req,res) => {
  var body = _.pick(req.body, ['username', 'password']);

  User.findByCredentials(body.username, body.password).then((user) => {
    return user.generateAuthToken().then((token) => {
      res.header('x-auth', token).send(user);
    });
  }).catch((e) => {
    res.status(400).send(e);
  });
});

//DELETE /users/logout
app.delete('/users/logout', authenticate, (req,res) => {
  req.user.removeToken(req.token).then(() => {
    res.status(200).send("Token deleted");
  }, () => {
    res.status(400).send("Token error");
  });
});

// app.use(express.static(__dirname + '/public'));


//
// hbs.registerHelper('screamIt', (text) => {
//   return text.toUpperCase()
// });



app.listen(port, () => {
  console.log(`Server is up on port ${port}`);
});
