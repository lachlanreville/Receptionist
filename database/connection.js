const mysql = require("mysql-await");

var con = mysql.createConnection({
    host: "db.receptioni.st",
    user: "lachlan",
    password: "88VLp1d42tpEdPSR",
    database: "receptionist",
    charset: "utf8mb4_unicode_ci"
});

con.connect(function (err) {
    if (err) throw err;
    console.log("Connected to database!");

    setInterval(function () {
        let sql = "SELECT * FROM servers WHERE guildid = '697407042108915725'"
        con.query(sql)
    }, 5 * 60 * 1000);
});

module.exports = { con }