const db = require('./database');

const init = async () => {
  await db.run(
    'CREATE TABLE Users (id INTEGER PRIMARY KEY AUTOINCREMENT, name varchar(32));'
  );
  await db.run(
    'CREATE TABLE Friends (id INTEGER PRIMARY KEY AUTOINCREMENT, userId int, friendId int);'
  );
  const users = [];
  const names = ['foo', 'bar', 'baz'];
  for (i = 0; i < 27000; ++i) {
    let n = i;
    let name = '';
    for (j = 0; j < 3; ++j) {
      name += names[n % 3];
      n = Math.floor(n / 3);
      name += n % 10;
      n = Math.floor(n / 10);
    }
    users.push(name);
  }
  const friends = users.map(() => []);
  for (i = 0; i < friends.length; ++i) {
    const n = 10 + Math.floor(90 * Math.random());
    const list = [...Array(n)].map(() =>
      Math.floor(friends.length * Math.random())
    );
    list.forEach((j) => {
      if (i === j) {
        return;
      }
      if (friends[i].indexOf(j) >= 0 || friends[j].indexOf(i) >= 0) {
        return;
      }
      friends[i].push(j);
      friends[j].push(i);
    });
  }
  console.log('Init Users Table...');
  await Promise.all(
    users.map((un) => db.run(`INSERT INTO Users (name) VALUES ('${un}');`))
  );
  console.log('Init Friends Table...');
  await Promise.all(
    friends.map((list, i) => {
      return Promise.all(
        list.map((j) =>
          db.run(
            `INSERT INTO Friends (userId, friendId) VALUES (${i + 1}, ${j + 1
            });`
          )
        )
      );
    })
  );
  console.log('Ready.');
};

// Optimized Search Route with Recursive CTE

const search = async (req, res) => {
  const query = `%${req.params.query}%`;
  const userId = parseInt(req.params.userId);

  try {
    const results = await db.all(
      `
      WITH RECURSIVE UserConnections AS (
        SELECT 
          Users.id,
          Users.name,
          CASE
            WHEN Friends.userId = ? THEN 1  -- Direct friend
            ELSE 0
          END AS connection
        FROM Users
        LEFT JOIN Friends ON Users.id = Friends.friendId AND Friends.userId = ?
        WHERE Users.name LIKE ? 

        UNION ALL

        SELECT 
          Users.id,
          Users.name,
          CASE
            WHEN Friends.userId IS NOT NULL AND UserConnections.connection = 0 THEN 2  -- Friend of a friend
            WHEN FriendOfFriend.friendId IS NOT NULL AND UserConnections.connection = 0 THEN 3  -- Friend of a friend of a friend
            WHEN FriendOfFriendOfFriend.friendId IS NOT NULL AND UserConnections.connection = 0 THEN 4  -- Friend of a friend of a friend of a friend
            ELSE 0
          END AS connection
        FROM UserConnections
        JOIN Friends ON UserConnections.id = Friends.userId
        JOIN Users ON Users.id = Friends.friendId
        LEFT JOIN Friends AS FriendOfFriend ON Users.id = FriendOfFriend.friendId
        LEFT JOIN Friends AS FriendOfFriendOfFriend ON Users.id = FriendOfFriendOfFriend.friendId
        WHERE Users.id <> ? AND Users.name LIKE ?
      )

      SELECT * FROM UserConnections
      ORDER BY connection, Users.id
      LIMIT 20;
      `,
      [userId, userId, query, userId, query]
    );

    res.status(200).json({
      success: true,
      users: results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// Function to add a friend
const addFriend = async (req, res) => {
  const userId = parseInt(req.params.userId);
  const friendId = parseInt(req.params.friendId);

  try {
    // Check if they are not already friends
    const areFriends = await db.get(
      'SELECT 1 FROM Friends WHERE userId = ? AND friendId = ?',
      [userId, friendId]
    );
    if (!areFriends) {
      // Add friend relationship
      await db.run('INSERT INTO Friends (userId, friendId) VALUES (?, ?)', [
        userId,
        friendId,
      ]);
      await db.run('INSERT INTO Friends (userId, friendId) VALUES (?, ?)', [
        friendId,
        userId,
      ]); // bidirectional friendship
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// Function to remove a friend
const removeFriend = async (req, res) => {
  const userId = parseInt(req.params.userId);
  const friendId = parseInt(req.params.friendId);

  try {
    // Remove friend relationship
    await db.run('DELETE FROM Friends WHERE userId = ? AND friendId = ?', [
      userId,
      friendId,
    ]);
    await db.run('DELETE FROM Friends WHERE userId = ? AND friendId = ?', [
      friendId,
      userId,
    ]); // bidirectional friendship

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

module.exports = { init, search, addFriend, removeFriend };
