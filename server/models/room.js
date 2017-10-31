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
    userID: String
  }],
  price: {
    type: Number,
    default: null,
    required: true
  }
});

var Room = mongoose.model('Room', RoomSchema);

module.exports = {
  Room
};
