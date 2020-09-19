const { MessageEmbed } = require("discord.js");
const { con } = require("../database/connection");

exports.use = async (client, message, args, server) => {

    //This code is about to get messy as fuck so GL

    // If something exists except for command
    if (args[0]) {
        // If the provided Argument is a URL
        if (isValidUrl(args[0])) {
            collected = args[0]
            collected = collected.split("/");
            let messageID = collected[collected.length - 1];
            let channelID = collected[collected.length - 2];

            if (isNaN(messageID) || isNaN(channelID)) {
                return message.channel.send("This is not a correct Message Link. Please try again.")
            }

            let response = await con.awaitQuery("SELECT applicationId, responses, authorId, responseId, reviewed, messageChannelId, messageId FROM responses WHERE guildId = ? AND messageChannelId = ? AND messageId = ?", [message.guild.id, channelID, messageID])

            if (response.length > 0) {
                response = response[0]

                AcceptApplication(message, response, response.applicationId)
            } else {
                message.channel.send("This is not a correct Application Response. Please retry with an appropriate Message Link")
            }
        } else {
            let response = await con.awaitQuery("SELECT applicationId, responses, authorId, responseId, reviewed, messageChannelId, messageId FROM responses WHERE guildId = ? AND responseId = ?", [message.guild.id, args[0]])

            if (response.length > 0) {
                response = response[0]
                AcceptApplication(message, response, response.applicationId)
            } else {
                message.channel.send("This is not a correct Application Response. Please retry with an appropriate Response ID")
            }
        }
    } else {
        let response = await con.awaitQuery("SELECT applicationId, responses, authorId, responseId, reviewed, messageChannelId, messageId FROM responses WHERE guildId = ? AND messageChannelId = ?", [message.guild.id, message.channel.id])

        if (response.length > 1) {
            return message.channel.send("There is too many applications inside of this channel. Try using a Response Id or a message link to a response")
        }

        if (response.length > 0) {
            response = response[0]
            AcceptApplication(message, response, response.applicationId)
        } else {
            return message.channel.send("Too use this command you need to run **r/accept responseid/response message link**")
        }
    }

};

function isValidUrl(string) {
    try {
        new URL(string);
    } catch (_) {
        return false;
    }

    return true;
}

async function AcceptApplication(message, responseData, applicationId) {

    let applicationData = await con.awaitQuery("SELECT applicationName, applicationAcceptRole, applicationReviewRole, applicationAcceptMessage FROM applications WHERE applicationID = ? AND guildid = ?", [applicationId, message.guild.id]);

    if (applicationData.length < 1) return;

    applicationData = applicationData[0];

    if (responseData.reviewed) return message.channel.send("This application has already been reviewed!")

    let serverData = await con.awaitQuery("SELECT prefix, premium, configRole, reviewerRole FROM servers WHERE guildid = ?", [message.guild.id]);

    serverData = serverData[0];

    let member = await message.guild.members.fetch(responseData.authorId)

    if (!member) {
        applicationError.setDescription("I am unable to find this applicant inside of this server.")
        return message.channel.send(applicationError);
    }

    let reviewPermission = false;

    let serverReviewRole = JSON.parse(serverData.reviewerRole);

    if (serverReviewRole.length > 0) {
        if (message.member.permissions.has("ADMINISTRATOR")) {
            reviewPermission = true
        } else {
            serverReviewRole.map(c => {
                if (message.member.roles.cache.has(c)) {
                    reviewPermission = true;
                }
            })
        }
    }

    let applicationReviewRole = JSON.parse(applicationData.applicationReviewRole)

    if (applicationReviewRole.length > 0 && reviewPermissions == false) {
        applicationReviewRole.map(c => {
            if (message.member.roles.cache.has(c)) {
                reviewPermission = true;
            }
        })
    }

    if (reviewPermission == false) {
        if (message.member.permissions.has("ADMINISTRATOR")) {
            reviewPermission = true;
        } else {
            let noPerms = new MessageEmbed()
                .setTitle("No Permissions")
                .setDescription(`Sorry ${message.member}, You do not have the required Roles to Review this Application`)
                .setColor("#0f4361");

            return await message.channel.send(noPerms)
        }
    }

    let applicationAcceptRole = JSON.parse(applicationData.applicationAcceptRole)

    if (applicationAcceptRole.length > 0) {
        applicationAcceptRole.map(async c => {
            let giveRole = await message.guild.roles.cache.get(applicationData.applicationAcceptRole)
            try {
                member.roles.add(giveRole)
            }
            catch (err) {
                return channel.send("I am unable to give users Roles.")
            }
        })
    }

    let AcceptMessage = new MessageEmbed()
        .setTitle(`${applicationData.applicationName} - Accepted`)
        .setColor("#0f4361");

    if (applicationData.applicationAcceptMessage != null && applicationData.applicationAcceptMessage != "") {
        AcceptMessage.setDescription(applicationData.applicationAcceptMessage)
    } else {
        AcceptMessage.setDescription(`Your application for ${applicationData.applicationName} in the server ${message.guild.name} has been accepted!`)
    }

    member.send(AcceptMessage).catch(c => {
        applicationError.setDescription("Cant direct message the user.");
        return channel.send(applicationError)
    });

    let AcceptedServer = new MessageEmbed()
        .setTitle('Accepted')
        .setColor("#0f4361")
        .setDescription("The application has been accepted.");

    message.channel.send(AcceptedServer)

    con.query("UPDATE responses SET reviewed = ? WHERE guildId = ? AND messageChannelId = ? and messageId = ? AND authorId = ?", [true, message.guild.id, responseData.messageChannelId, responseData.messageId, responseData.authorId])
}