const { con } = require('../database/connection');

async function clearDatabase() {
    con.query("DELETE FROM responses WHERE responses IS NULL")
}

module.exports = { clearDatabase }