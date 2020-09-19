const { MessageEmbed } = require("discord.js");
const { con } = require("../database/connection");

exports.use = async (client, message, args, server) => {
    const helpEmbed = new MessageEmbed()
        .setTitle("Help - Receptionist")
        .setFooter(`Powered by https://receptioni.st`)
        .setColor("#0f4361")
        .addField("r/setup", "Walks your through the steps to setup an Application.")
        .addField("r/settings", "Reaction Based pages so you can edit your server settings with ease.")
        .addField("r/apply", "Apply for Applications that set to use the Apply command.")
        .addField("r/review", "Review Applications")
        .addField("r/accept", "Accept Applications")
        .addField("r/deny", "Deny Applications")
        .addField("r/help", "Triggers this panel.");

    message.channel.send(helpEmbed)
};
