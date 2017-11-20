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
var {Room} = require('./models/room.js');
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

hbs.registerPartials(__dirname + '/../views/partials');
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

//GET /
app.get('/', (req,res) => {
  res.render('start.hbs');
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
      res.redirect('/editProfile');
    }).catch((e) => {
      res.status(400).send(e);
    })
  });
});

// GET /profile
app.get('/profile', checkSignIn, (req,res) => {
  User.findById(req.session.user._id).then((user) => {
    Room.findById(user.roomID).then((room) => {
      //console.log(room);
      res.render('profile.hbs' ,{
        pageTitle: 'Profile',
        username: user.username,
        name: user.name,
        phone: user.phone,
        email: user.email,
        rating: Math.round(user.rating * 100) / 100,
        room: room
      });
    });
  });
});

//GET /login2
app.get('/login2', (req, res) => {
  req.session.destroy(() => {
    console.log("User logged out.");
  });
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
      //console.log(req.session.user);
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

// //redirects to login page if users tries to access profile without logging in first
// app.use('/profile', (err, req, res, next) => {
//   console.log(err);
//    //User should be authenticated! Redirect him to log in.
//   res.redirect('/login2');
// });

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
  if (id == req.session.user._id) {
    return res.redirect('/profile');
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

// GET /createRoom
app.get('/createRoom', checkSignIn, (req,res) => {
  res.render('createRoom.hbs', {
    pageTitle: 'Create New Room'
  });
});

// POST /createRoom
app.post('/createRoom', checkSignIn, (req, res) => {
  //var body = _.pick(req.body, ['username', 'password']);
  //var user = req.session.user;
  var form = new formidable.IncomingForm();
  form.parse(req,function(err,fields,files) {
    var room = new Room({
      creatorID: req.session.user._id,
      size: fields.size,
      address: fields.address,
      price: fields.price
    });

    User.findById(req.session.user._id).then((user) => {
      if(!user) {
        return res.status(404).send("ID not found.");
      }
      if(user.roomID){
        return res.status(400).send("You are already in another room group");
      }
      user.roomID = room._id;
      user.save();
      room.users.push({userID: req.session.user._id});
      room.save();
      res.redirect('/mygroup');
    });
  });
});

app.get('/rooms', (req,res) => {
  Room.find().then((rooms) => {
    if(!rooms){
      return res.status(404).send("RoomID not found.");
    }
    res.render('rooms.hbs', {
      pageTitle: 'All Rooms',
      rooms: rooms
    });
  });
});

app.get('/rooms/join/:id', checkSignIn, (req,res) => {
  var id = req.params.id;
  if (!ObjectID.isValid(id)) {
    return res.status(404).send("Invalid ID");
  }
  Room.findById(id).then((room) => {
    if(!room){
      return res.status(404).send("RoomID not found.");
    }
    for(i=0; i<room.users.length; i++) {
      if(room.users[i].userID == req.session.user._id){
        return res.status(400).send("You are already in this room group");
      }
    }
    User.findById(req.session.user._id).then((user) => {
      if(!user) {
        return res.status(404).send("ID not found.");
      }
      if(user.roomID){
        return res.status(400).send("You are already in another room group");
      }
      user.roomID = id;
      user.save();
      room.users.push({userID: user._id});
      room.save();
      res.redirect('/mygroup');
    });
  });
});

app.get('/rooms/leave', checkSignIn, (req,res) => {
  User.findById(req.session.user._id).then((user) => {
    if(!user) {
      return res.status(404).send("User not found.");
    }
    //console.log(user.roomID);
    Room.findById(user.roomID).then((room) => {
      if(!room) {
        return res.status(404).send("Room not found.");
      }
      if(user._id == room.creatorID && room.users.length > 1) {
        return res.status(400).send("Room creator cannot leave room while there are other users in the room");
      }
      if (user._id == room.creatorID && room.users.length == 1) {
        Room.findByIdAndRemove(room._id).then(() => {
          user.roomID = null;
          user.save();
          res.redirect('/profile');
        }, () => {
          res.status(400).send("Error deleting room");
        });
      } else {
        room.removeUser(user._id).then(() => {
          //console.log(room.users);
          user.roomID = null;
          user.save();
          res.redirect('/profile');
        }, () => {
          res.status(400).send("Error removing user from room");
        });
      }
    });
  });
});

app.get('/kick/:id', checkSignIn,(req,res) => {
  id = req.params.id;
  if (id == req.session.user._id) {
    return res.status(400).send("Cannot kick yourself.");
  }
  User.findById(id).then((user) => {
    if(!user) {
      return res.status(404).send("User not found.");
    }
    Room.findById(user.roomID).then((room) => {
      if(!room) {
        return res.status(404).send("Room not found.");
      }
      if(room.creatorID != req.session.user._id) {
        return res.status(401).send("Only the room creator can kick other users.");
      }
      room.removeUser(user._id).then(() => {
        //console.log(room.users);
        user.roomID = null;
        user.save();
        res.redirect('/mygroup');
      }, () => {
        res.status(400).send("Error removing user from room");
      });
    });
  });
})

app.get('/mygroup', checkSignIn, (req,res) => {
  User.findById(req.session.user._id).then((user) => {
    Room.findById(user.roomID).then((room) => {
      //console.log(room);
      if(!room) {
        res.redirect('/nogroup');
      }
      res.render('myGroup.hbs' ,{
        pageTitle: 'My Group',
        Uid : user._id,
        room: room,
        creatorID: room.creatorID
      });
    });
  });
});

app.get('/nogroup', checkSignIn, (req,res) => {
  res.render('noGroup.hbs');
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
hbs.registerHelper('ifCond', function (v1, operator, v2, options) {

    switch (operator) {
        case '==':
            return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
            return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
            return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
            return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
            return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
            return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
            return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
            return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
            return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
            return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
            return options.inverse(this);
    }
});



app.listen(port, () => {
  console.log(`Server is up on port ${port}`);
});
