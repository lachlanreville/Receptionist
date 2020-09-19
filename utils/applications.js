const { con } = require('../database/connection');
const { MessageEmbed } = require('discord.js');
const moment = require("moment");
const randomString = require('randomstring')
const { response } = require('express');

async function applications(applicationId, guildId, message, serverData) {

    let applicationData = await con.awaitQuery("SELECT applicationName, type, applicationLogChannel, applicationStartRole, applicationChannelName, applicationCategoryId, applicationResponseWait, applicationStartChannel FROM applications WHERE applicationID = ? AND guildid = ?", [applicationId, message.guild.id]);

    if (applicationData.length < 1) return;

    applicationData = applicationData[0];

    if (applicationData.applicationStartChannel != null && applicationData.applicationStartChannel != "") {
        if (applicationData.applicationStartChannel == message.channel.id) {
            //do nothing
        } else {
            let noPerms = new MessageEmbed()
                .setTitle("No Permissions")
                .setDescription(`Sorry ${message.member}, You cannot apply for that application in this channel.`)
                .setColor("#0f4361");

            return message.channel.send(noPerms)
        }
    }
    let permission = false;

    let startRole = JSON.parse(applicationData.applicationStartRole)

    if (startRole != null && startRole.length > 0) {
        startRole.map(c => {
            if (message.member.roles.cache.has(c)) {
                permission = true;
            }
        })
    } else {
        permission = true;
    }

    if (permission == false) {
        let noPerms = new MessageEmbed()
            .setTitle("No Permissions")
            .setDescription(`Sorry ${message.member}, You dont have the required roles to start this application.`)
            .setColor("#0f4361");

        return message.channel.send(noPerms)
    }

    let applicationResponses = await con.awaitQuery("SELECT responses, appliedTime FROM responses WHERE guildId = ? AND authorId = ? AND applicationId = ?", [guildId, message.author.id, applicationId])

    if (applicationResponses.length > 0 && applicationData.applicationResponseWait) {
        for (let i = 0; i < applicationResponses.length; i++) {
            if (!applicationResponses[i].responses) {
                return message.channel.send("You currently have this application started.")
            }

            let time = applicationData.applicationResponseWait.split(" ")
            let applicationTime = moment(applicationResponses[i].appliedTime).add(time[0], time[1]).format("YYYY-MM-DD kk:mm:ss");
            let currentTime = moment().format("YYYY-MM-DD kk:mm:ss")
            if (applicationTime < currentTime) {
                continue;
            } else {
                return message.channel.send("You cannot apply again until " + applicationTime + ". (AEST)")
            }
        }
    }
    let currentTime = moment().format("YYYY-MM-DD kk:mm:ss")

    await con.awaitQuery("INSERT INTO responses (guildId, applicationId, authorId, appliedTime) VALUES (?, ?, ?, ?)", [message.guild.id, applicationId, message.author.id, currentTime])

    let ApplicationQuestions = await con.awaitQuery("SELECT applicationQuestions FROM questions WHERE applicationID = ? AND guildID = ?", [applicationId, message.guild.id])

    questions = JSON.parse(ApplicationQuestions[0].applicationQuestions);

    let QuestionEmbed = new MessageEmbed();

    if (applicationData.type == 1) {
        let confirmationMessage = new MessageEmbed()
            .setTitle("Application Started - " + applicationData.applicationName)
            .setDescription(`Hello ${message.member}, Your Application has been started in DMs.`)
            .setColor("#0f4361");

        message.channel.send(confirmationMessage)

        let checkingMessage = new MessageEmbed()
            .setTitle("Application Started")
            .setDescription("Application has been started. Type Cancel and anytime to cancel.")
            .setColor("#0f4361");

        message.member.send(checkingMessage).catch(async c => {
            message.channel.send("Sorry I dont have Access to DM you, please allow Direct Messages from users.")
            await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [message.guild.id, applicationId, message.author.id, currentTime])
        })

        let member = message.member;
        let msg;
        let reply = [];

        for (i = 0; i < questions.length; i++) {
            QuestionEmbed.setDescription("**" + questions[i] + "** - (" + (i + 1) + "/" + questions.length + ")")
                .setColor("#0f4361");

            msg = await member.send(QuestionEmbed);

            newMsg = await msg.channel.awaitMessages(m => m.author.id == member.id, { time: 600000, max: 1, errors: ['time'] }).catch(async c => {
                member.send("The Application Has Timed Out.");
                await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [message.guild.id, applicationId, message.author.id, currentTime])
            });

            if (!newMsg) return;

            newReply = newMsg.first().content;

            if (newReply.toLowerCase() == "cancel") {
                let notSent = new MessageEmbed()
                    .setTitle("Not Sent")
                    .setDescription("Your application is closed.")
                    .setColor("#0f4361");
                await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [message.guild.id, applicationId, message.author.id, currentTime])

                return member.send(notSent);

            } else {
                if (newReply == "") {
                    i--;
                    member.send("Answer cant be empty")
                    continue;
                } else {
                    reply[i] = newReply;
                }
            }
        }

        let areYouSure = new MessageEmbed()
            .setTitle("Confirmation")
            .setDescription("Are you sure you want to apply?")
            .setColor("#0f4361");

        let confirm = await message.member.send(areYouSure);
        confirm.react('✅')
        confirm.react('❌')

        let confirmation = await confirm.awaitReactions((reaction, u) => u.id == message.member.id && ["✅", "❌"].includes(reaction.emoji.name), { max: 1, time: 600000, errors: ["time"] })

        if (confirmation.first().emoji.name == "✅") {

            let random = randomString.generate(16);

            let applicationMessage = new MessageEmbed()
                .setTitle("New Application - " + message.author.username + "#" + message.author.discriminator)
                .setFooter("Application - " + applicationData.applicationName + " Response Id - " + random)
                .setColor("#0f4361");

            let length = (reply.length > 20) ? 20 : reply.length;

            let maxChar = Math.floor((6000 - applicationMessage.length) / length);

            let totalPages = Math.ceil(reply.length / 20)
            if (reply.length > 20) {
                applicationMessage.setFooter("Application - " + applicationData.applicationName + " Page " + (responseData.page + 1) + "/" + totalPages + ". Response Id -" + random)
            }
            for (let i = 0; i < length; i++) {
                let answer = reply[i];
                let questionMax = Math.floor(maxChar - questions[i].split("").length)
                if (answer.length >= questionMax) {
                    answer = await changeStringLength(answer, questionMax)
                }
                applicationMessage.addField(questions[i], answer);
            }

            let channelid;

            if (applicationData.applicationLogChannel != null && applicationData.applicationLogChannel != "") {
                channelid = applicationData.applicationLogChannel;
            }

            if (!channelid) {
                member.send("This server hasnt setup a Logs Channel. Please notify an Admin to get this fixed.");
                await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [message.guild.id, applicationId, message.author.id, currentTime])
            }

            let applicationChannelName = applicationData.applicationChannelName ? applicationData.applicationChannelName : "application";

            let applicationCategoryId = applicationData.applicationCategoryId ? applicationData.applicationCategoryId : null

            let channel;

            if (channelid == "multiple") {
                channel = await message.guild.channels.create(applicationChannelName + "-" + message.member.id, {
                    type: "text",
                    topic: applicationData.applicationName,
                    permissionOverwrites: [
                        {
                            id: message.guild.id,
                            deny: ["VIEW_CHANNEL"]
                        }
                    ]
                }).catch(async c => {
                    member.send("I am unable to create channels.")
                    await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [message.guild.id, applicationId, message.author.id, currentTime])
                })

                if (applicationCategoryId !== null) {
                    channel.setParent(applicationCategoryId)
                }
            } else {
                channel = message.guild.channels.cache.get(channelid)
            }

            if (!channel || channel == null) {
                let error = new MessageEmbed()
                    .setTitle("Application Error")
                    .setDescription(`Sorry ${message.member}, This server doesnt have an appropriate Applications Log Channel setup.`)
                    .setColor("#0f4361");

                await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [message.guild.id, applicationId, message.author.id, currentTime])
                return member.send(error)
            }

            let sent = await channel.send(applicationMessage)

            if (reply.length >= 20) {
                await sent.react("⬅️")
            }
            sent.react('✅')
            await sent.react('📄')
            sent.react('❌')
            if (reply.length >= 20) {
                await sent.react("➡️")
            }

            let sentApp = new MessageEmbed()
                .setTitle("Application Sent")
                .setDescription(`Thanks ${message.member}, Your application has been sent in for review.`)
                .setColor("#0f4361");

            await message.member.send(sentApp).catch(async c => {
                member.send("An error has occured and im not too sure what exactly went wrong....");
                await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [message.guild.id, applicationId, message.author.id, currentTime])
            })

            return await con.awaitQuery("INSERT INTO responses (authorid, applicationId, appliedTime, guildId, responses, messageChannelId, messageId, responseId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [member.id, applicationId, currentTime, message.guild.id, JSON.stringify(reply), sent.channel.id, sent.id, random])
        } else {
            let notSent = new MessageEmbed()
                .setTitle("Not Sent")
                .setDescription("Your application has not been sent.")
                .setColor("#0f4361");

            message.member.send(notSent)

            await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [message.guild.id, applicationId, message.author.id, currentTime])
        }
    } else {
        let applicationChannelName = applicationData.applicationChannelName ? applicationData.applicationChannelName : "application";

        let applicationCategoryId = applicationData.applicationCategoryId ? applicationData.applicationCategoryId : null

        let appChannel = await message.guild.channels.create(applicationChannelName + "-" + message.member.id, {
            type: "text",
            topic: applicationData.applicationName,
            permissionOverwrites: [
                {
                    id: message.member.id,
                    allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"]
                },
                {
                    id: message.guild.id,
                    deny: ["VIEW_CHANNEL"]
                }
            ]
        }).catch(c => {
            member.send("I am unable to create channels.")
        })

        if (applicationCategoryId !== null) {
            appChannel.setParent(applicationCategoryId)
        }

        let reply = [];
        let msg;

        let confirmationMessage = new MessageEmbed()
            .setTitle("Application Started")
            .setDescription(`Application has been started in ${appChannel}.`)
            .setColor("#0f4361");

        message.channel.send(confirmationMessage)

        appChannel.send(`${message.member}`)

        for (i = 0; i < questions.length; i++) {
            QuestionEmbed.setDescription("**" + questions[i] + "** - (" + (i + 1) + "/" + questions.length + ")")
                .setColor("#0f4361");

            msg = await appChannel.send(QuestionEmbed);

            newMsg = await msg.channel.awaitMessages(m => m.author.id == message.member.id, { time: 600000, max: 1, errors: ['time'] }).catch(async c => {
                await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [message.guild.id, applicationId, message.author.id, currentTime])

                return appChannel.send("The Application Has Timed Out.");
            });

            if (!newMsg) return;

            newReply = newMsg.first().content;

            if (newReply.toLowerCase() == "cancel") {
                let notSent = new MessageEmbed()
                    .setTitle("Not Sent")
                    .setDescription("Your application will close in 5 seconds.")
                    .setColor("#0f4361");

                await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [message.guild.id, applicationId, message.author.id, currentTime])

                await appChannel.send(notSent);

                setTimeout(async () => {
                    await appChannel.delete();
                }, 5000)
            } else {
                if (newReply == "") {
                    i--;
                    member.send("Answer cant be empty")
                    continue;
                } else {
                    reply[i] = newReply;
                }
            }
        }

        let areYouSure = new MessageEmbed()
            .setTitle("Confirmation")
            .setDescription("Are you sure you want to apply?")
            .setColor("#0f4361");

        let confirm = await appChannel.send(areYouSure);
        confirm.react('✅')
        confirm.react('❌')

        let confirmation = await confirm.awaitReactions((reaction, u) => u.id == message.member.id && ["✅", "❌"].includes(reaction.emoji.name), { max: 1, time: 600000, errors: ["time"] })

        if (confirmation.first().emoji.name == "✅") {

            let random = randomString.generate(16);

            let applicationMessage = new MessageEmbed()
                .setTitle("New Application - " + message.author.username + "#" + message.author.discriminator)
                .setFooter("Application - " + applicationData.applicationName + " Response Id - " + random)
                .setColor("#0f4361");

            let length = (reply.length > 20) ? 20 : reply.length;

            let maxChar = Math.floor((6000 - applicationMessage.length) / length);

            let totalPages = Math.ceil(reply.length / 20)
            if (reply.length > 20) {
                applicationMessage.setFooter("Application - " + applicationData.applicationName + " Page " + (responseData.page + 1) + "/" + totalPages + ". Response Id -" + random)
            }

            for (i = 0; i < length; i++) {
                let answer = reply[i];
                let questionMax = Math.floor(maxChar - questions[i].split("").length)
                if (answer.length >= questionMax) {
                    answer = await changeStringLength(answer, questionMax)
                }
                applicationMessage.addField(questions[i], answer);
            }

            let channelid;

            if (applicationData.applicationLogChannel != null && applicationData.applicationLogChannel != "") {
                channelid = applicationData.applicationLogChannel;
            }

            if (channelid == "multiple") {
                channelid = appChannel.id
            }

            if (!channelid) return;

            let channel = message.guild.channels.cache.has(channelid) ? message.guild.channels.cache.get(channelid) : message.guild.channel.fetch(channelid);

            let sent = await channel.send(applicationMessage)

            if (reply.length >= 20) {
                await sent.react("⬅️")
            }
            sent.react('✅')
            await sent.react('📄')
            sent.react('❌')
            if (reply.length >= 20) {
                await sent.react("➡️")
            }


            if (channelid != appChannel.id) {
                let sentApp = new MessageEmbed()
                    .setTitle("Application Sent")
                    .setDescription(`Thanks ${message.member}, Your application has been sent in for review.`)
                    .setColor("#0f4361");

                await appChannel.send(sentApp);
            }

            let time = moment().format("YYYY-MM-DD kk:mm:ss")

            return await con.awaitQuery("INSERT INTO responses (authorid, applicationId, appliedTime, guildId,  responses, messageChannelId, messageId, responseId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [member.id, applicationId, currentTime, message.guild.id, JSON.stringify(reply), sent.channel.id, sent.id, random])

        } else {
            let notSent = new MessageEmbed()
                .setTitle("Not Sent")
                .setDescription("Your application will close in 5 seconds.")
                .setColor("#0f4361");

            await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [message.guild.id, applicationId, message.author.id, currentTime])


            appChannel.send(notSent);

            setTimeout(() => {
                appChannel.delete();
            }, 5000)
        }
    }

}

async function reactionApplications(applicationId, reaction, client, guild, member) {
    let applicationData = await con.awaitQuery("SELECT applicationName, type, applicationLogChannel, applicationStartRole, applicationChannelName, applicationCategoryId, applicationResponseWait, applicationStartChannel FROM applications WHERE applicationID = ? AND guildid = ?", [applicationId, guild.id]);
    applicationData = applicationData[0];

    let channel = guild.channels.cache.get(reaction.channel_id);

    if (applicationData.applicationStartChannel != null && applicationData.applicationStartChannel != "") {
        if (applicationData.applicationStartChannel == channel.id) {
            //do nothing
        } else {
            let noPerms = new MessageEmbed()
                .setTitle("No Permissions")
                .setDescription(`Sorry ${member}, You cannot apply for that application in this channel.`)
                .setColor("#0f4361");

            let c = await member.send(noPerms)
            c.delete({ time: 5000 })
        }
    }
    let permission = false;

    let startRole = JSON.parse(applicationData.applicationStartRole)

    if (startRole != null && startRole.length > 0) {
        startRole.map(c => {
            if (message.member.roles.cache.has(c)) {
                permission = true;
            }
        })
    } else {
        permission = true;
    }

    if (permission == false) {
        let noPerms = new MessageEmbed()
            .setTitle("No Permissions")
            .setDescription(`Sorry ${message.member}, You dont have the required roles to start this application.`)
            .setColor("#0f4361");

        return message.channel.send(noPerms)
    }


    let applicationResponses = await con.awaitQuery("SELECT responses, appliedTime FROM responses WHERE guildId = ? AND authorId = ? AND applicationId = ?", [guild.id, member.id, applicationId])

    if (applicationResponses.length > 0 && applicationData.applicationResponseWait) {
        for (let i = 0; i < applicationResponses.length; i++) {
            if (!applicationResponses[i].responses) {
                return member.send("You have already started this application.")
            }
            let time = applicationData.applicationResponseWait.split(" ")
            let applicationTime = moment(applicationResponses[i].appliedTime).add(time[0], time[1]).format("YYYY-MM-DD kk:mm:ss");
            let currentTime = moment().format("YYYY-MM-DD kk:mm:ss")
            if (applicationTime < currentTime) {
                continue;
            } else {
                return member.send("You cannot apply again until " + applicationTime + ". (AEST)")
            }
        }
    }

    let currentTime = moment().format("YYYY-MM-DD kk:mm:ss")

    await con.awaitQuery("INSERT INTO responses (guildId, applicationId, authorId, appliedTime) VALUES (?, ?, ?, ?)", [guild.id, applicationId, member.id, currentTime])

    let ApplicationQuestions = await con.awaitQuery("SELECT applicationQuestions FROM questions WHERE applicationID = ? AND guildID = ?", [applicationId, guild.id])

    questions = JSON.parse(ApplicationQuestions[0].applicationQuestions);

    let QuestionEmbed = new MessageEmbed();

    if (applicationData.type == 1) {
        let checkingMessage = new MessageEmbed()
            .setTitle("Application Started")
            .setDescription("Application has been started. Type Cancel and anytime to cancel.")
            .setColor("#0f4361");

        member.send(checkingMessage).catch(async c => {
            //do nothing
            await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [guild.id, applicationId, member.id, currentTime])
        })

        let msg;
        let reply = [];

        for (i = 0; i < questions.length; i++) {
            QuestionEmbed.setDescription("**" + questions[i] + "** - (" + (i + 1) + "/" + questions.length + ")")
                .setColor("#0f4361");

            msg = await member.send(QuestionEmbed);

            newMsg = await msg.channel.awaitMessages(m => m.author.id == member.id, { time: 600000, max: 1, errors: ['time'] }).catch(async c => {
                member.send("The Application Has Timed Out.");
                await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [guild.id, applicationId, member.id, currentTime])
            });

            if (!newMsg) return;

            newReply = newMsg.first().content;

            if (newReply.toLowerCase() == "cancel") {
                let notSent = new MessageEmbed()
                    .setTitle("Not Sent")
                    .setDescription("Your application is closed.")
                    .setColor("#0f4361");
                await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [guild.id, applicationId, member.id, currentTime])

                return member.send(notSent);

            } else {
                if (newReply == "") {
                    i--;
                    member.send("Answer cant be empty")
                    continue;
                } else {
                    reply[i] = newReply;
                }
            }
        }

        let areYouSure = new MessageEmbed()
            .setTitle("Confirmation")
            .setDescription("Are you sure you want to apply?")
            .setColor("#0f4361");

        let confirm = await member.send(areYouSure);
        confirm.react('✅')
        confirm.react('❌')

        let confirmation = await confirm.awaitReactions((reaction, u) => u.id == member.id && ["✅", "❌"].includes(reaction.emoji.name), { max: 1, time: 600000, errors: ["time"] })
        if (!confirmation) {
            await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [guild.id, applicationId, member.id, currentTime])
            return member.send("Timed out")
        }

        if (confirmation.first().emoji.name == "✅") {

            let random = randomString.generate(16);

            let applicationMessage = new MessageEmbed()
                .setTitle("New Application - " + member.username + "#" + member.discriminator)
                .setFooter("Application - " + applicationData.applicationName + " Response Id - " + random)
                .setColor("#0f4361");

            let length = (reply.length > 20) ? 20 : reply.length;

            let maxChar = Math.floor((6000 - applicationMessage.length) / length);

            let totalPages = Math.ceil(reply.length / 20)
            if (reply.length > 20) {
                applicationMessage.setFooter("Application - " + applicationData.applicationName + " Page " + (responseData.page + 1) + "/" + totalPages + ". Response Id -" + random)
            }

            for (i = 0; i < length; i++) {
                let question = "Q" + (i + 1) + " " + questions[i]
                let answer = reply[i];
                let questionMax = Math.floor(maxChar - question.split("").length)
                if (answer.length >= questionMax) {
                    answer = await changeStringLength(answer, questionMax)
                }
                applicationMessage.addField(question, answer);
            }

            let channelid;

            if (applicationData.applicationLogChannel != null && applicationData.applicationLogChannel != "") {
                channelid = applicationData.applicationLogChannel;
            }

            let applicationChannelName = applicationData.applicationChannelName ? applicationData.applicationChannelName : "application";

            let applicationCategoryId = applicationData.applicationCategoryId ? applicationData.applicationCategoryId : null


            if (!channelid) {
                member.send("This server hasnt setup a Logs Channel. Please notify an Admin to get this fixed.");
                await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [guild.id, applicationId, member.id, currentTime])
            }

            let channel;

            if (channelid == "multiple") {
                let appChannel = await guild.channels.create(applicationChannelName + "-" + member.id, {
                    type: "text",
                    topic: applicationData.applicationName,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: ["VIEW_CHANNEL"]
                        }
                    ]
                }).catch(async c => {
                    member.send("I am unable to create channels")
                    await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [guild.id, applicationId, member.id, currentTime])

                })

                if (applicationCategoryId !== null) {
                    appChannel.setParent(applicationCategoryId)
                }
                channel = appChannel;
            } else {
                channel = guild.channels.cache.get(channelid)
            }

            if (!channel || channel == null) {
                let error = new MessageEmbed()
                    .setTitle("Application Error")
                    .setDescription(`Sorry ${message.member}, This server doesnt have an appropriate Applications Log Channel setup.`)
                    .setColor("#0f4361");
                await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ? AND responses IS NULL", [guild.id, applicationId, member.id, currentTime])

                return member.send(error)
            }

            let sent = await channel.send(applicationMessage)

            if (reply.length >= 20) {
                await sent.react("⬅️")
            }
            sent.react('✅')
            await sent.react('📄')
            sent.react('❌')
            if (reply.length >= 20) {
                await sent.react("➡️")
            }

            let sentApp = new MessageEmbed()
                .setTitle("Application Sent")
                .setDescription(`Thanks ${member}, Your application has been sent in for review.`)
                .setColor("#0f4361");

            member.send(sentApp)

            let time = moment().format("YYYY-MM-DD kk:mm:ss")

            return await con.awaitQuery("INSERT INTO responses (authorid, applicationId, appliedTime, guildId,  responses, messageChannelId, messageId, responseId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [member.id, applicationId, currentTime, guild.id, JSON.stringify(reply), sent.channel.id, sent.id, random])

        } else {
            let notSent = new MessageEmbed()
                .setTitle("Not Sent")
                .setDescription("Your application has not been sent.")
                .setColor("#0f4361");
            await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ?", [guild.id, applicationId, member.id, currentTime])

            return member.send(notSent)
        }

    } else {
        let applicationChannelName = applicationData.applicationChannelName ? applicationData.applicationChannelName : "application";

        let applicationCategoryId = applicationData.applicationCategoryId ? applicationData.applicationCategoryId : null

        let appChannel = await guild.channels.create(applicationChannelName + "-" + member.id, {
            type: "text",
            topic: applicationData.applicationName,
            permissionOverwrites: [
                {
                    id: member.id,
                    allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"]
                },
                {
                    id: guild.id,
                    deny: ["VIEW_CHANNEL"]
                }
            ]
        }).catch(async c => {
            member.send("I am unable to create channels")
            await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ?", [guild.id, applicationId, member.id, currentTime])

        })

        if (applicationCategoryId !== null) {
            appChannel.setParent(applicationCategoryId)
        }

        let reply = [];
        let msg;

        for (i = 0; i < questions.length; i++) {
            QuestionEmbed.setDescription("**" + questions[i] + "** - (" + (i + 1) + "/" + questions.length + ")")
                .setColor("#0f4361");

            msg = await appChannel.send(QuestionEmbed);

            newMsg = await msg.channel.awaitMessages(m => m.author.id == member.id, { time: 600000, max: 1, errors: ['time'] }).catch(async c => {
                appChannel.send("The Application Has Timed Out.");
                await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ?", [guild.id, applicationId, member.id, currentTime])

            });

            if (!newMsg) return;

            newReply = newMsg.first().content;

            if (newReply.toLowerCase() == "cancel") {
                let notSent = new MessageEmbed()
                    .setTitle("Not Sent")
                    .setDescription("Your application will close in 5 seconds.")
                    .setColor("#0f4361");
                await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ?", [guild.id, applicationId, member.id, currentTime])

                await appChannel.send(notSent);

                setTimeout(async () => {
                    await appChannel.delete();
                }, 5000)
            } else {
                if (newReply == "") {
                    i--;
                    member.send("Answer cant be empty")
                    continue;
                } else {
                    reply[i] = newReply;
                }
            }
        }

        let areYouSure = new MessageEmbed()
            .setTitle("Confirmation")
            .setDescription("Are you sure you want to apply?")
            .setColor("#0f4361");

        let confirm = await appChannel.send(areYouSure);
        confirm.react('✅')
        confirm.react('❌')

        let confirmation = await confirm.awaitReactions((reaction, u) => u.id == member.id && ["✅", "❌"].includes(reaction.emoji.name), { max: 1, time: 600000, errors: ["time"] })

        if (confirmation.first().emoji.name == "✅") {

            let random = randomString.generate(16);

            let applicationMessage = new MessageEmbed()
                .setTitle("New Application - " + member.username + "#" + member.discriminator)
                .setFooter("Application - " + applicationData.applicationName + " Response Id - " + random)
                .setColor("#0f4361");

            let length = (reply.length > 20) ? 20 : reply.length;

            let maxChar = Math.floor((6000 - applicationMessage.length) / length);

            let totalPages = Math.ceil(reply.length / 20)
            if (reply.length > 20) {
                applicationMessage.setFooter("Application - " + applicationData.applicationName + " Page " + (responseData.page + 1) + "/" + totalPages + ". Response Id -" + random)
            }

            for (i = 0; i < length; i++) {
                let question = "Q" + (i + 1) + " " + questions[i]
                let answer = reply[i];
                let questionMax = Math.floor(maxChar - question.split("").length)
                if (answer.length >= questionMax) {
                    answer = await changeStringLength(answer, questionMax)
                }
                applicationMessage.addField(question, answer);
            }

            let channelid;

            if (applicationData.applicationLogChannel != null && applicationData.applicationLogChannel != "") {
                channelid = applicationData.applicationLogChannel;
            }

            if (channelid == "multiple") {
                channelid = appChannel.id
            }

            if (!channelid) return;

            let channel = guild.channels.cache.get(channelid)

            if (!channel) {
                appChannel.send("This application doesnt have an appropriate Applications Channel Log")
                await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ?", [guild.id, applicationId, member.id, currentTime])
            }

            let sent = await channel.send(applicationMessage)

            if (reply.length >= 20) {
                await sent.react("⬅️")
            }
            sent.react('✅')
            await sent.react('📄')
            sent.react('❌')
            if (reply.length >= 20) {
                await sent.react("➡️")
            }


            if (channelid != appChannel.id) {
                let sentApp = new MessageEmbed()
                    .setTitle("Application Sent")
                    .setDescription(`Thanks ${member}, Your application has been sent in for review.`)
                    .setColor("#0f4361");

                appChannel.send(sentApp);
            }

            return await con.awaitQuery("INSERT INTO responses (authorid, applicationId, appliedTime, guildId,  responses, messageChannelId, messageId, responseId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [member.id, applicationId, currentTime, guild.id, JSON.stringify(reply), sent.channel.id, sent.id, random])

        } else {
            let notSent = new MessageEmbed()
                .setTitle("Not Sent")
                .setDescription("Your application will close in 5 seconds.")
                .setColor("#0f4361");
            await con.awaitQuery("DELETE FROM responses WHERE guildId = ? AND applicationId = ? AND authorId = ? AND appliedTime = ?", [guild.id, applicationId, member.id, currentTime])

            appChannel.send(notSent);

            setTimeout(() => {
                appChannel.delete();
            }, 5000)
        }
    }
}

async function acceptApplication(reaction, responseData, reactionGuild, member) {

    let applicationError = new MessageEmbed()
        .setTitle("Error")
        .setColor("#0f4361");

    let applicationData = await con.awaitQuery("SELECT applicationName, applicationAcceptRole, applicationReviewRole, applicationAcceptMessage FROM applications WHERE applicationID = ? AND guildid = ?", [responseData.applicationId, reactionGuild.id]);

    if (applicationData.length < 1) return;

    applicationData = applicationData[0];

    let channel = reactionGuild.channels.cache.get(reaction.channel_id);

    let user = await reactionGuild.members.fetch(responseData.authorId)

    if (responseData.reviewed == true) {
        return channel.send(applicationError.setDescription("This application has already been reviewed!"))
    }

    if (!user) {
        applicationError.setDescription("I am unable to find this applicant inside of this server.")
        return channel.send(applicationError);
    }

    let serverData = await con.awaitQuery("SELECT prefix, premium, configRole, reviewerRole FROM servers WHERE guildid = ?", [reactionGuild.id]);

    serverData = serverData[0];
    let reviewPermission = false;

    let serverReviewRole = JSON.parse(serverData.reviewerRole);

    if (serverReviewRole.length > 0) {
        if (member.permissions.has("ADMINISTRATOR")) {
            reviewPermission = true
        } else {
            serverReviewRole.map(async c => {
                if (member.roles.cache.has(c)) {
                    reviewPermission = true;
                }
            })
        }
    }

    let applicationReviewRole = JSON.parse(applicationData.applicationReviewRole)

    if (applicationReviewRole.length > 0 && reviewPermissions == false) {
        applicationReviewRole.map(async c => {
            if (member.roles.cache.has(c)) {
                reviewPermission = true;
            }
        })
    }

    if (reviewPermission == false) {
        if (member.permissions.has("ADMINISTRATOR")) {
            reviewPermission = true;
        } else {
            let noPerms = new MessageEmbed()
                .setTitle("No Permissions")
                .setDescription(`Sorry ${member}, You do not have the required role to accept applications.`)
                .setColor("#0f4361");

            return await channel.send(noPerms)
        }
    }

    let applicationAcceptRole = JSON.parse(applicationData.applicationAcceptRole)

    if (applicationAcceptRole.length > 0) {
        applicationAcceptRole.map(async c => {
            let giveRole = await reactionGuild.roles.cache.get(applicationData.applicationAcceptRole)
            try {
                user.roles.add(giveRole)
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
        AcceptMessage.setDescription(`Your application for ${applicationData.applicationName} in the server ${reactionGuild.name} has been accepted!`)
    }

    user.send(AcceptMessage).catch(c => {
        applicationError.setDescription("Cant direct message the user.");
        return channel.send(applicationError)
    });

    let AcceptedServer = new MessageEmbed()
        .setTitle('Accepted')
        .setColor("#0f4361")
        .setDescription("The application has been accepted.");

    channel.send(AcceptedServer)

    con.query("UPDATE responses SET reviewed = ? WHERE guildId = ? AND messageChannelId = ? and messageId = ? AND authorId = ?", [true, reactionGuild.id, reaction.channel_id, reaction.message_id, user.id])
}

async function denyApplication(reaction, responseData, reactionGuild, member) {

    let applicationError = new MessageEmbed()
        .setTitle("Error")
        .setColor("#0f4361");

    let applicationData = await con.awaitQuery("SELECT applicationName, applicationReviewRole, applicationDenyMessage FROM applications WHERE applicationID = ? AND guildid = ?", [responseData.applicationId, reactionGuild.id]);

    if (applicationData.length < 1) return;

    applicationData = applicationData[0];

    let channel = reactionGuild.channels.cache.get(reaction.channel_id);

    let user = await reactionGuild.members.fetch(responseData.authorId)

    if (responseData.reviewed == true) {
        return channel.send(applicationError.setDescription("This application has already been reviewed!"))
    }

    if (!user) {
        applicationError.setDescription("I am unable to find this applicant inside of this server.")
        return channel.send(applicationError)
    }

    let serverData = await con.awaitQuery("SELECT prefix, premium, configRole, reviewerRole FROM servers WHERE guildid = ?", [reactionGuild.id]);

    serverData = serverData[0];
    let reviewPermission = false;

    let serverReviewRole = JSON.parse(serverData.reviewerRole);

    if (serverReviewRole.length > 0) {
        if (member.permissions.has("ADMINISTRATOR")) {
            reviewPermission = true
        } else {
            serverReviewRole.map(c => {
                if (member.roles.cache.has(c)) {
                    reviewPermission = true;
                }
            })
        }
    }

    let applicationReviewRole = JSON.parse(applicationData.applicationReviewRole)

    if (applicationReviewRole.length > 0 && reviewPermissions == false) {
        applicationReviewRole.map(c => {
            if (member.roles.cache.has(c)) {
                reviewPermission = true;
            }
        })
    }

    if (reviewPermission == false) {
        if (member.permissions.has("ADMINISTRATOR")) {
            reviewPermission = true
        } else {
            let noPerms = new MessageEmbed()
                .setTitle("No Permissions")
                .setDescription(`Sorry ${member}, You do not have the required role to deny applications.`)
                .setColor("#0f4361");

            return await channel.send(noPerms)
        }
    }

    let DenyMessage = new MessageEmbed()
        .setTitle(`${applicationData.applicationName} - Denied`)
        .setColor("#0f4361");

    if (applicationData.applicationDenyMessage != null && applicationData.applicationDenyMessage != "") {
        DenyMessage.setDescription(applicationData.applicationDenyMessage)
    } else {
        DenyMessage.setDescription(`Your application for ${applicationData.applicationName} in the server ${reactionGuild.name} has been denied.`)
    }

    user.send(DenyMessage).catch(c => {
        applicationError.setDescription("Cant direct message the user.");
        return channel.send(applicationError)
    });

    let DenyServer = new MessageEmbed()
        .setTitle('Accepted')
        .setColor("#0f4361")
        .setDescription("The application has been denied.");

    channel.send(DenyServer)

    con.query("UPDATE responses SET reviewed = ? WHERE guildId = ? AND messageChannelId = ? and messageId = ? AND authorId = ?", [true, reactionGuild.id, reaction.channel_id, reaction.message_id, user.id])
}

async function changePage(reaction, responseData, reactionGuild, reactionMessage, channel, member, type) {
    let ApplicationQuestions = await con.awaitQuery("SELECT applicationQuestions FROM questions WHERE applicationID = ? AND guildID = ?", [responseData.applicationId, reactionGuild.id])
    let applicationData = await con.awaitQuery("SELECT applicationName, applicationReviewRole FROM applications WHERE guildId = ? AND applicationId = ?", [reactionGuild.id, responseData.applicationId])
    let serverData = await con.awaitQuery("SELECT prefix, premium, configRole, reviewerRole FROM servers WHERE guildid = ?", [reactionGuild.id]);
    serverData = serverData[0];
    applicationData = applicationData[0];

    let reviewPermission = false;

    let serverReviewRole = JSON.parse(serverData.reviewerRole);

    if (serverReviewRole.length > 0) {
        if (member.permissions.has("ADMINISTRATOR")) {
            reviewPermission = true
        } else {
            serverReviewRole.map(c => {
                if (member.roles.cache.has(c)) {
                    reviewPermission = true;
                }
            })
        }
    }

    let applicationReviewRole = JSON.parse(applicationData.applicationReviewRole)

    if (applicationReviewRole.length > 0 && reviewPermissions == false) {
        applicationReviewRole.map(c => {
            if (member.roles.cache.has(c)) {
                reviewPermission = true;
            }
        })
    }

    if (reviewPermission == false) {
        if (member.permissions.has("ADMINISTRATOR")) {
            reviewPermission = true;
        } else {
            let noPerms = new MessageEmbed()
                .setTitle("No Permissions")
                .setDescription(`Sorry ${member}, You do not have the required Roles to change Pages`)
                .setColor("#0f4361");

            return await channel.send(noPerms)
        }
    }

    if (type == "forward") {

        let reply = JSON.parse(responseData.responses)
        if (reply.length <= 20) return;

        let totalPages = Math.ceil(reply.length / 20)

        let pageNo = (totalPages > responseData.page) ? responseData.page + 1 : 1

        let startingNumber = (20 * (pageNo)) - 19;
        let endingNumber = 20 * (pageNo)

        let applicationMessage = new MessageEmbed()
            .setTitle(reactionMessage.embeds[0].title)
            .setColor("#0f4361");


        if (reply.length > 20) {
            applicationMessage.setFooter("Application - " + applicationData.applicationName + " Page " + (responseData.page + 1) + "/" + totalPages + ". Response Id -" + responseData.responseId)
        }

        reply.splice(0, startingNumber - 1)

        let questions = JSON.parse(ApplicationQuestions[0].applicationQuestions);
        questions.splice(0, startingNumber - 1);

        let length = (reply.length > 20) ? 20 : reply.length;

        let maxChar = Math.floor((6000 - applicationMessage.length) / length);

        for (i = 0; i < length; i++) {
            let question = "Q" + (startingNumber + i) + " " + questions[i]
            let answer = reply[i];
            let questionMax = Math.floor(maxChar - question.split("").length)
            if (questionMax >= 1024) questionMax = 1024
            if (answer.length >= questionMax) {
                answer = await changeStringLength(answer, questionMax)
            }
            applicationMessage.addField(question, answer);
        }
        reactionMessage.edit(applicationMessage)

        return con.awaitQuery("UPDATE responses SET page = ? WHERE guildId = ? AND messageChannelId = ? and messageId = ?", [pageNo, reaction.guild_id, reaction.channel_id, reaction.message_id])
    }
    if (type == "backwards") {
        let reply = JSON.parse(responseData.responses)

        let questions = JSON.parse(ApplicationQuestions[0].applicationQuestions);

        let totalPages = Math.ceil(reply.length / 20)

        let pageNo = (1 < responseData.page) ? responseData.page - 1 : totalPages

        let applicationMessage = new MessageEmbed()
            .setTitle(reactionMessage.embeds[0].title)
            .setColor("#0f4361");


        let startingNumber = (20 * (pageNo)) - 19;
        let endingNumber = 20 * (pageNo)

        if (startingNumber < 1) {
            startingNumber = (20 * (totalPages)) - 19
            console.log(startingNumber)
        }
        if (reply.length > 20) {
            applicationMessage.setFooter("Application - " + applicationData.applicationName + " Page " + (responseData.page + 1) + "/" + totalPages + ". Response Id -" + responseData.responseId)
        }

        reply.splice(0, startingNumber - 1)

        questions.splice(0, startingNumber - 1);

        let length = (reply.length > 20) ? 20 : reply.length;

        let maxChar = Math.floor((6000 - applicationMessage.length) / length);

        for (i = 0; i < length; i++) {
            let question = "Q" + (startingNumber + i) + " " + questions[i]
            let answer = reply[i];
            let questionMax = Math.floor(maxChar - question.split("").length)
            if (questionMax >= 1024) questionMax = 1024
            if (answer.length >= questionMax) {
                answer = await changeStringLength(answer, questionMax)
            }
            applicationMessage.addField(question, answer);
        }

        reactionMessage.edit(applicationMessage)
        return con.awaitQuery("UPDATE responses SET page = ? WHERE guildId = ? AND messageChannelId = ? and messageId = ?", [pageNo, reaction.guild_id, reaction.channel_id, reaction.message_id])

    }
}

async function reviewApplication(reaction, responseData, reactionGuild, reactionChannel, reactionUser) {
    let ApplicationQuestions = await con.awaitQuery("SELECT applicationQuestions FROM questions WHERE applicationID = ? AND guildID = ?", [responseData.applicationId, reactionGuild.id])
    let applicationData = await con.awaitQuery("SELECT applicationName, applicationReviewRole FROM applications WHERE guildId = ? AND applicationId = ?", [reactionGuild.id, responseData.applicationId])
    let serverData = await con.awaitQuery("SELECT prefix, premium, configRole, reviewerRole FROM servers WHERE guildid = ?", [reactionGuild.id]);

    serverData = serverData[0];
    applicationData = applicationData[0];
    ApplicationQuestions = ApplicationQuestions[0];

    let responses = JSON.parse(responseData.responses)
    let questions = JSON.parse(ApplicationQuestions.applicationQuestions)

    let member = await reactionGuild.members.fetch(responseData.authorId)

    if (!member) {
        applicationError.setDescription("I am unable to find this applicant inside of this server.")
        return channel.send(applicationError);
    }

    let reviewPermission = false;

    let serverReviewRole = JSON.parse(serverData.reviewerRole);

    if (serverReviewRole.length > 0) {
        if (reactionUser.permissions.has("ADMINISTRATOR")) {
            reviewPermission = true
        } else {
            serverReviewRole.map(c => {
                if (reactionUser.roles.cache.has(c)) {
                    reviewPermission = true;
                }
            })
        }
    }

    let applicationReviewRole = JSON.parse(applicationData.applicationReviewRole)

    if (applicationReviewRole.length > 0 && reviewPermissions == false) {
        applicationReviewRole.map(c => {
            if (reactionUser.roles.cache.has(c)) {
                reviewPermission = true;
            }
        })
    }

    if (reviewPermission == false) {
        if (reactionUser.permissions.has("ADMINISTRATOR")) {
            reviewPermission = true;
        } else {
            let noPerms = new MessageEmbed()
                .setTitle("No Permissions")
                .setDescription(`Sorry ${reactionUser}, You do not have the required Roles to Review this Application`)
                .setColor("#0f4361");

            return await channel.send(noPerms)
        }
    }
    let masterMessage;

    for (let i = 0; i < responses.length; i++) {
        let reviewEmbed = new MessageEmbed()
            .setTitle("**" + questions[i] + "** - (" + (i + 1) + "/" + questions.length + ")\n\n")
            .setColor("#0f4361")
            .setFooter("Application: " + member.user.username + "#" + member.user.discriminator + " - Reviewing Application: " + applicationData.applicationName + " - Response Id: " + responseData.responseId)
            .setDescription(responses[i]);

        if (!masterMessage) {
            masterMessage = await reactionChannel.send(reviewEmbed)
            await masterMessage.react("⬅️");
            await masterMessage.react("❌")
            await masterMessage.react("➡️")
            let choice = await masterMessage.awaitReactions((reaction, u) => u.id == reactionUser.id && ["⬅️", "❌", "➡️"].includes(reaction.emoji.name), { max: 1, time: 600000, errors: ["time"] }).catch(c => {
                return message.channel.send("Reviewing Session has Timed out")
            })
            if (!choice) return message.channel.send("Reviewing Session has Timed out")
            choice = choice.first().emoji.name;
            let newReaction = masterMessage.reactions.cache.get(choice)
            try {
                newReaction.users.remove(reactionUser)
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
                reactionChannel.send("Reviewing session has ended.")
                break;
            }
        } else {
            masterMessage.edit(reviewEmbed)
            let choice = await masterMessage.awaitReactions((reaction, u) => u.id == reactionUser.id && ["⬅️", "❌", "➡️"].includes(reaction.emoji.name), { max: 1, time: 600000, errors: ["time"] }).catch(c => {
                return message.channel.send("Reviewing Session has Timed out")
            })
            if (!choice) return message.channel.send("Reviewing Session has Timed out")
            choice = choice.first().emoji.name;

            let newReaction = masterMessage.reactions.cache.get(choice)
            try {
                newReaction.users.remove(reactionUser)
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
                reactionChannel.send("Reviewing session has ended.")
                break;
            }
        }
    }
}

async function changeStringLength(string, maxLength = 297) {
    let newStr = string.split("")
    newStr.splice(maxLength - 4, newStr.length)
    newStr = newStr.join("");
    newStr += "..."
    return newStr;
}


module.exports = { applications, reactionApplications, acceptApplication, denyApplication, changePage, reviewApplication }