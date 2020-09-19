const { ShardingManager } = require("discord.js");
const { token } = require('./utils/config')

const sharder = new ShardingManager('./index.js', {
    token
});


sharder.spawn()