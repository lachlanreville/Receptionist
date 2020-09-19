const { MessageEmbed } = require("discord.js");
const { con } = require("../database/connection");

exports.use = async (client, message, args, server) => {
    if (message.author.id != "180860826457079808") return message.reply("no perms")
    client.commands.get("resetCommands").reset()
    return message.reply("done")
};
