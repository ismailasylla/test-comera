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
module.exports.init = init;

const search = async (req, res) => {
  const query = req.params.query;
  const userId = parseInt(req.params.userId);

  try {
    const results = await db.all(
      `
      SELECT 
        Users.id,
        Users.name,
        CASE
          WHEN Friends.userId = ? THEN 1  -- Direct friend
          WHEN Users.id = ? THEN 0  -- The user themselves
          WHEN FriendOfFriend.friendId IS NOT NULL THEN 2  -- Friend of a friend
          WHEN FriendOfFriendOfFriend.friendId IS NOT NULL THEN 3  -- 3rd connection
          WHEN FriendOfFriendOfFriendOfFriend.friendId IS NOT NULL THEN 4  -- 4th connection
          ELSE 0
        END AS connection
      FROM Users
      LEFT JOIN Friends ON Users.id = Friends.friendId AND Friends.userId = ?
      LEFT JOIN (
        SELECT f2.friendId
        FROM Friends f1
        JOIN Friends f2 ON f1.friendId = f2.userId
        WHERE f1.userId = ?
      ) AS FriendOfFriend ON Users.id = FriendOfFriend.friendId
      LEFT JOIN (
        SELECT f3.friendId
        FROM Friends f1
        JOIN Friends f2 ON f1.friendId = f2.userId
        JOIN Friends f3 ON f2.friendId = f3.userId
        WHERE f1.userId = ?
      ) AS FriendOfFriendOfFriend ON Users.id = FriendOfFriendOfFriend.friendId
      LEFT JOIN (
        SELECT f4.friendId
        FROM Friends f1
        JOIN Friends f2 ON f1.friendId = f2.userId
        JOIN Friends f3 ON f2.friendId = f3.userId
        JOIN Friends f4 ON f3.friendId = f4.userId
        WHERE f1.userId = ?
      ) AS FriendOfFriendOfFriendOfFriend ON Users.id = FriendOfFriendOfFriendOfFriend.friendId
      WHERE Users.name LIKE ? LIMIT 20;
    `,
      [userId, userId, userId, userId, userId, `${query}%`]
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

module.exports.search = search;
