const db = require("./database");

const init = async () => {
  await db.run(
    "CREATE TABLE Users (id INTEGER PRIMARY KEY AUTOINCREMENT, name varchar(32));"
  );
  await db.run(
    "CREATE TABLE Friends (id INTEGER PRIMARY KEY AUTOINCREMENT, userId int, friendId int);"
  );
  const users = [];
  const names = ["foo", "bar", "baz"];
  for (i = 0; i < 27000; ++i) {
    let n = i;
    let name = "";
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
  console.log("Init Users Table...");
  await Promise.all(
    users.map((un) => db.run(`INSERT INTO Users (name) VALUES ('${un}');`))
  );
  console.log("Init Friends Table...");
  await Promise.all(
    friends.map((list, i) => {
      return Promise.all(
        list.map((j) =>
          db.run(
            `INSERT INTO Friends (userId, friendId) VALUES (${i + 1}, ${
              j + 1
            });`
          )
        )
      );
    })
  );
  console.log("Ready.");
};

const search = async (req, res) => {
  const query = req.params.query;
  const userId = parseInt(req.params.userId);

  try {
    const results = await db.all(
      `
      SELECT 
        Users.id,
        Users.name,
        COALESCE(Friends.connection, 0) AS connection
      FROM Users
      LEFT JOIN (
        SELECT 
          friendId,
          CASE
            WHEN userId = ? THEN 1
            WHEN userId IS NULL THEN 2
            ELSE 3
          END AS connection
        FROM Friends
      ) AS Friends ON Users.id = Friends.friendId
      WHERE Users.name LIKE ? AND (Users.id != ? OR Users.id IS NULL)
      LIMIT 20;
    `,
      [userId, `${query}%`, userId]
    );

    res.status(200).json({
      success: true,
      users: results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

// Function to add a friend
const addFriend = async (req, res) => {
  const userId = parseInt(req.params.userId);
  const friendId = parseInt(req.params.friendId);

  try {
    // Check if they are not already friends
    const areFriends = await db.get(
      "SELECT 1 FROM Friends WHERE userId = ? AND friendId = ?",
      [userId, friendId]
    );
    if (!areFriends) {
      // Add friend relationship
      await db.run("INSERT INTO Friends (userId, friendId) VALUES (?, ?)", [
        userId,
        friendId,
      ]);
      await db.run("INSERT INTO Friends (userId, friendId) VALUES (?, ?)", [
        friendId,
        userId,
      ]); // bidirectional friendship
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

// Function to remove a friend
const removeFriend = async (req, res) => {
  const userId = parseInt(req.params.userId);
  const friendId = parseInt(req.params.friendId);

  try {
    // Remove friend relationship
    await db.run("DELETE FROM Friends WHERE userId = ? AND friendId = ?", [
      userId,
      friendId,
    ]);
    await db.run("DELETE FROM Friends WHERE userId = ? AND friendId = ?", [
      friendId,
      userId,
    ]); // bidirectional friendship

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

module.exports = { init, search, addFriend, removeFriend };
