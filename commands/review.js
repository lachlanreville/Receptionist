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

            let response = await con.awaitQuery("SELECT applicationId, responses, authorId, responseId FROM responses WHERE guildId = ? AND messageChannelId = ? and messageId = ?", [message.guild.id, channelID, messageID])

            if (response.length > 0) {
                response = response[0]
                ReviewApplication(message, response, response.applicationId)
            } else {
                message.channel.send("This is not a correct Application Response. Please retry with an appropriate Message Link")
            }
        } else {
            let response = await con.awaitQuery("SELECT applicationId, responses, authorId, responseId FROM responses WHERE guildId = ? AND responseId = ?", [message.guild.id, args[0]])

            if (response.length > 0) {
                response = response[0]
                ReviewApplication(message, response, response.applicationId)
            } else {
                message.channel.send("This is not a correct Application Response. Please retry with an appropriate Response ID")
            }
        }
    } else {
        let response = await con.awaitQuery("SELECT applicationId, responses, authorId, responseId FROM responses WHERE guildId = ? AND messageChannelId = ?", [message.guild.id, message.channel.id])

        if (response.length > 1) {
            return message.channel.send("There is too many applications inside of this channel. Try using a Response Id or a message link to a response")
        }

        if (response.length > 0) {
            response = response[0]
            ReviewApplication(message, response, response.applicationId)
        } else {
            return message.channel.send("Too use this command you ened to run **r/review responseid/response message link**")
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

async function ReviewApplication(message, responseData, applicationId) {

    let ApplicationQuestions = await con.awaitQuery("SELECT applicationQuestions FROM questions WHERE applicationID = ? AND guildID = ?", [applicationId, message.guild.id])
    let applicationData = await con.awaitQuery("SELECT applicationName, applicationReviewRole FROM applications WHERE guildId = ? AND applicationId = ?", [message.guild.id, applicationId])
    let serverData = await con.awaitQuery("SELECT prefix, premium, configRole, reviewerRole FROM servers WHERE guildid = ?", [message.guild.id]);

    ApplicationQuestions = ApplicationQuestions[0];
    serverData = serverData[0];
    applicationData = applicationData[0];

    let questions = JSON.parse(ApplicationQuestions.applicationQuestions)

    let responses = JSON.parse(responseData.responses)
    let masterMessage;

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

    for (let i = 0; i < responses.length; i++) {
        let reviewEmbed = new MessageEmbed()
            .setTitle("**" + questions[i] + "** - (" + (i + 1) + "/" + questions.length + ")\n\n")
            .setColor("#0f4361")
            .setFooter("Application: " + member.user.username + "#" + member.user.discriminator + " - Reviewing Application: " + applicationData.applicationName + " - Response Id: " + responseData.responseId)
            .setDescription(responses[i]);

        if (!masterMessage) {
            masterMessage = await message.channel.send(reviewEmbed)
            await masterMessage.react("⬅️");
            await masterMessage.react("❌")
            await masterMessage.react("➡️")
            let choice = await masterMessage.awaitReactions((reaction, u) => u.id == message.member.id && ["⬅️", "❌", "➡️"].includes(reaction.emoji.name), { max: 1, time: 600000, errors: ["time"] }).catch(c => {
                return message.channel.send("Reviewing Session has Timed out")
            })
            if (!choice) return message.channel.send("Reviewing Session has Timed out")
            choice = choice.first().emoji.name;
            let newReaction = masterMessage.reactions.cache.get(choice)
            try {
                newReaction.users.remove(message.member)
            }
            catch (err) {
                //do nothingggggggggggg
                console.log(err)
            }

            if (choice == "⬅️") {
                if (i == 0) {
                    i--;
                    continue;
                }
                i--; i--; continue;
            }
            if (choice == "➡️") {
                continue;
            }
            if (choice == "❌") {
                message.channel.send("Reviewing session has ended.")
                break;
            }
        } else {
            masterMessage.edit(reviewEmbed)
            let choice = await masterMessage.awaitReactions((reaction, u) => u.id == message.member.id && ["⬅️", "❌", "➡️"].includes(reaction.emoji.name), { max: 1, time: 600000, errors: ["time"] }).catch(c => {
                return message.channel.send("Reviewing Session has Timed out")
            })
            if (!choice) return message.channel.send("Reviewing Session has Timed out")
            choice = choice.first().emoji.name;

            let newReaction = masterMessage.reactions.cache.get(choice)
            try {
                newReaction.users.remove(message.member)
            }
            catch (err) {
                //do nothingggggggggggg
            }

            if (choice == "⬅️") {
                if (i == 0) {
                    i--;
                    continue;
                }
                i--; i--; continue;
            }
            if (choice == "➡️") {
                continue;
            }
            if (choice == "❌") {
                message.channel.send("Reviewing session has ended.")
                break;
            }
        }
    }
}