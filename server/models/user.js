const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

var UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    unique: true,
  },
  email: {
    type: String,
    // required: true,
    default: null,
    trim: true
    // unique: true,
    // validate: {
    //   validator: validator.isEmail,
    //   message: `{VALUE} is not a valid email`
    // }
  },
  password: {
    type: String,
    required: true,
    minlength: 1
  },
  name: {
    type: String,
    default: ""
  },
  phone: {
    type: String,
    default: ""
  },
  rating: {
    type: Number,
    default: null
  },
  ratings: [{
    value: {
      type: Number,
      default: null
    },
    text: {
      type: String,
      default: null
    },
    raterID: {
      type: String,
      default: null
    }
  }]
});

//Shows only primary id and email, hides all other information
UserSchema.methods.toJSON = function () {
  var user = this;
  var userObject = user.toObject();

  return _.pick(userObject, ['_id', 'username', 'name', 'phone', 'email']);
};

//generate authentication token for user
UserSchema.methods.generateAuthToken = function () {
  var user = this;
  var access = 'auth';
  var token = jwt.sign({_id: user._id.toHexString(), access}, 'abc123').toString();

  user.tokens.push({access: access, token: token});

  return user.save().then(() => {
    return token;
  });
};

//Push the new rating value and text to the array
UserSchema.methods.updateRatings = function (fields,viewer) {
  var user = this;
  var value = fields.rating;
  var text = fields.comment;
  var raterID = viewer._id;
  user.ratings.push({value: value, text: text, raterID: raterID});
  user.save();
};

//Calculate the new average rating and store it in the rating field
UserSchema.methods.calculateRatings = function () {
  var user = this;
  var rating = 0;
  for (var i = 0 ; i < user.ratings.length; i ++) {
    rating += user.ratings[i].value;
    //console.log(rating);
  }
  rating = rating/user.ratings.length;
  //console.log(rating);
  user.rating = rating;
  user.save();
};

//remove the token
UserSchema.methods.removeToken = function (token) {
  var user = this;

  return user.update({
    $pull: {
      tokens: {
        token: token
      }
    }
  })
};

//find user by token
UserSchema.statics.findByToken = function (token) {
  var User = this;
  var decoded;

 try {
   decoded = jwt.verify(token, 'abc123');
 }
 catch (e) {
  return Promise.reject("Unable to authenticate.");
 }

 return User.findOne({
   '_id': decoded._id,
   'tokens.token': token,
   'tokens.access': 'auth'
 });
};

//find user by email and password
UserSchema.statics.findByCredentials = function (username, password) {
  var User = this;

  return User.findOne({username}).then((user) => {
    if (!user) {
      return Promise.reject("User not found.");
    }

    return new Promise((resolve, reject) => {
      bcrypt.compare(password, user.password, (err, res) => {
        if(res){
          resolve(user);
        }
        else {
          reject("Invalid password");
        }
      });
    });
  });
};

//salt and hash password if changed
UserSchema.pre('save', function (next) {
  var user = this;

  if (user.isModified('password')) {
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(user.password, salt, (err, hash) => {
        user.password = hash;
        next();
      });
    });
  }
  else {
    next();
  }
});


// User
var User = mongoose.model('User', UserSchema);

module.exports = {
  User
};
