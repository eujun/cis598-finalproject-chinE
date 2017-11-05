const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

var RoomSchema = new mongoose.Schema({
  creatorID: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    default: 1,
    required: true
  },
  address: {
    type: String,
    default: null,
    required: true
  },
  users: [{
    userID: {
      type: String,
      unique: true
    }
  }],
  price: {
    type: Number,
    default: null,
    required: true
  }
});

RoomSchema.methods.removeUser = function (id) {
  var room = this;
  return room.update({
    $pull: {
      users: {
        userID: id
      }
    }
  })
};

var Room = mongoose.model('Room', RoomSchema);

module.exports = {
  Room
};
