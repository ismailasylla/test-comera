const express = require('express');

const user = require('./user');

const router = express.Router();

router.get('/search/:userId/:query', user.search);

// Friend route
router.get('/friend/:userId/:friendId', user.addFriend);

// Unfriend route
router.get('/unfriend/:userId/:friendId', user.removeFriend);


module.exports = router;