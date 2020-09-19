const { MessageEmbed } = require("discord.js");
const { con } = require("../database/connection");
const { applications } = require('../utils/applications')

exports.use = async (client, message, args, server) => {
    let Applications = await con.awaitQuery("SELECT applicationID from `triggertypes` WHERE `trigger` = 3 AND `enabled` = 1 AND guildid = ?", [message.guild.id])

    let applicationData = [];

    if (Applications.length < 1) return message.channel.send("There are no applications setup on this server to work with the r/apply command.")

    if (Applications.length == 1) {
        return applications(Applications[0].applicationID, message.guild.id, message, server)
    }

    for (let i = 0; i < Applications.length; i++) {
        let appData = await con.awaitQuery("SELECT applicationID, applicationName FROM applications WHERE applicationID = ? AND guildID = ?", [Applications[i].applicationID, message.guild.id])
        applicationData.push(appData[0])
    }

    const applyEmbed = new MessageEmbed()
        .setTitle("Applications that are available")
        .setFooter(`Powered by https://receptioni.st`)
        .setColor("#0f4361");

    let numberArr = []

    for (let i = 0; i < applicationData.length; i++) {
        numberArr.push((i + 1).toString())
        applyEmbed.addField(`${i + 1}. ${applicationData[i].applicationName}`, `Reply with ${i + 1} to apply for this application.`, true)
    }

    message.channel.send(applyEmbed)

    let applicationResponse = await message.channel.awaitMessages(m => m.author.id == message.author.id && numberArr.includes(m.content), { max: 1, time: 600000, errors: ['time'] })
    if (!applicationResponse.first()) {
        return message.channel.send("Timed out.")
    }

    applicationResponse = applicationResponse.first().content;

    for (let i = 0; i < numberArr.length; i++) {
        if (i + 1 == applicationResponse) {
            return applications(applicationData[i].applicationID, message.guild.id, message, server)
        }
    }
};
