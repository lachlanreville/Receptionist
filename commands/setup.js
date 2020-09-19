const { MessageEmbed, DiscordAPIError } = require("discord.js");
const { con } = require("../database/connection");
const randomString = require("randomstring");

exports.use = async (client, message, args, server) => {
    if (!message.member.roles.cache.has(server.reviewerRole) && !message.member.permissions.has("ADMINISTRATOR")) return message.channel.send("You do not have permission to run this command")

    let setupMessage = new MessageEmbed()
        .setTitle("Application Manager Setup")
        .setColor("#0f4361");

    const currentApplications = await con.awaitQuery('SELECT applicationName FROM applications WHERE guildID = ?', [message.guild.id])

    if (currentApplications.length > 0 && server.premium == false) {
        setupMessage.setDescription("You can only have 1 Application setup as a non-premium user. If you would like to create more than 1 please consider purchasing premium as it really helps us keep this bot alive and it is only a few dollars a month.")
        return message.channel.send(setupMessage)
    }

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

    setupMessage.setDescription("What would you like the application to be named?");

    message.channel.send({ embed: setupMessage });

    let applicationReply = await message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 600000, errors: ['time'] }).catch(c => {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    });

    if (!applicationReply) {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    }

    applicationName = applicationReply.first().content;

    applicationReply.delete({ time: 1000 })

    setupMessage.setDescription("Where would you like applicants to fill out applications:\n:one: Inside of applicants DMs\n :two: Inside of a Channel");

    let messageReact = await message.channel.send({ embed: setupMessage }).catch(c => {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    });;
    messageReact.react(emojis[0]).catch(c => {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    });;
    messageReact.react(emojis[1]).catch(c => {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    });;

    let choice = await messageReact.awaitReactions((reaction, u) => u.id == message.member.id && [emojis[0], emojis[1]].includes(reaction.emoji.name), { max: 1, time: 600000, errors: ["time"] }).catch(c => {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    });;

    if (!choice) {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    }

    choice = choice.first().emoji.name;

    if (choice == emojis[0]) {
        choice = 1;
    } else {
        choice = 2;
    }

    QuestionDescription = "Please reply with your Questions. When you are finished type 'Done'. Please note you can only have 15 Questions Maximum for non-premium Servers and only 240 Characters for each Question (Discords limitations))"

    setupMessage.setDescription(QuestionDescription);

    let notDone = false;

    let questionArray = [];

    let a = await message.channel.send({ embed: setupMessage }).catch(c => {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    });

    i = 0;

    while (notDone == false) {
        i += 1;
        questions = await message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 600000, errors: ['time'] }).catch(c => {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })
        });

        if (!questions) {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })
        }

        question = questions.first();

        if (question.content.toLowerCase() == "done") {
            notDone = true;
        } else {
            if (question.content.split("").length >= 240) {
                setupMessage.setDescription("The question length is greater then 240 characters. Please reply with a shorter question...")
                return message.channel.send(setupMessage)
            }
            if (questionArray.length >= 15 && server.premium != true) {
                message.channel.send("Your Application has 15 Questions and you do not have premium. I am now going to start the next step.")
                notDone = true;
            }
            questionArray.push(question.content);
            QuestionDescription += `\nQuestion ${i}: ${question.content}`;
            setupMessage.setDescription(QuestionDescription);
            a.edit({ embed: setupMessage }).catch(c => {
                setupMessage.setDescription("There was an error. Please try again")
                return message.channel.send({ embed: setupMessage })
            });;
            question.delete({ time: 1000 })
        }
    }

    setupMessage.setDescription("Where would you like your Applications to be sent for Review\n:one: A channel that you have already made.\n:two: A channel that I will make.\n:three: One channel per Applicant. (Please note, if you have chosen for Applicants to apply through a channel. This will send the application into the Applicants channel.)");

    let logChannel = await message.channel.send(setupMessage).catch(c => {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    })

    logChannel.react(emojis[0]).catch(c => {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    });

    logChannel.react(emojis[1]).catch(c => {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    });

    logChannel.react(emojis[2]).catch(c => {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    });

    let logChannelChoice = await logChannel.awaitReactions((reaction, u) => u.id == message.member.id && [emojis[0], emojis[1], emojis[2]].includes(reaction.emoji.name), { max: 1, time: 600000, errors: ["time"] }).catch(c => {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    });

    if (!logChannelChoice) {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    }

    let logChoice = logChannelChoice.first().emoji.name;
    let channelid;

    if (logChoice == emojis[0]) {

        setupMessage.setDescription("Please tag the Channel you would like the Logs to go to. eg <#" + message.channel.id + ">")
        message.channel.send(setupMessage);

        let channelLogs = await message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 600000, errors: ["time"] }).catch(c => {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })
        });
        if (!channelLogs) {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })
        }

        var regexPattern = /[1-9]/g;
        channelid = channelLogs.first().content.match(regexPattern).join("");

    } else if (logChoice == emojis[1]) {

        setupMessage.setDescription("Im currently creating a channel for you now. Please stand by.")
        let msg = await message.channel.send(setupMessage);
        let appChannel;

        try {
            appChannel = await message.guild.channels.create("application-logs", {
                type: "text",
                permissionOverwrites: [
                    {
                        id: message.guild.id,
                        deny: ["VIEW_CHANNEL"]
                    }
                ]
            })
        }
        catch (err) {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })

        }

        setupMessage.setDescription("I have a created a channel called <#" + appChannel.id + ">. You are allowed to do with this channel what you would like.")
        msg.edit(setupMessage);

        channelid = appChannel.id

    } else if (logChoice == emojis[2]) {
        channelid = "multiple"
    }

    setupMessage.setDescription("How would you like to start the applications. \n:one: for a custom command. E.G. r/moderator, \n:two: for a Reaction on a set message, \n:three: to use the r/apply command ");

    let startingMessage = await message.channel.send({ embed: setupMessage }).catch(c => {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    });

    startingMessage.react(emojis[0]).catch(c => {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    });

    startingMessage.react(emojis[1]).catch(c => {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    });

    startingMessage.react(emojis[2]).catch(c => {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    });

    let starting = await startingMessage.awaitReactions((reaction, u) => u.id == message.member.id && [emojis[0], emojis[1], emojis[2]].includes(reaction.emoji.name), { max: 1, time: 600000, errors: ["time"] }).catch(c => {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    });

    if (!starting) {
        setupMessage.setDescription("There was an error. Please try again")
        return message.channel.send({ embed: setupMessage })
    }

    starting = starting.first().emoji.name;

    let trigger;

    if (starting == emojis[0]) {
        trigger = 1;

        setupMessage.setDescription("What would you like your command to be? (Please note, dont include the Prefix)");

        message.channel.send({ embed: setupMessage }).catch(c => {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })
        });

        let command = await message.channel.awaitMessages(m => m.member.id == message.member.id, { max: 1, time: 600000, errors: ['time'] }).catch(c => {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })
        });

        if (!command) {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })
        }

        command = command.first().content;

        setupMessage.setDescription("Your application has been setup and is now ready to use!");

        message.channel.send({ embed: setupMessage }).catch(c => {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })
        });

        let random = randomString.generate(12);

        let emptyArray = []
        emptyArray = JSON.stringify(emptyArray)

        con.query("INSERT INTO applications (guildID, applicationID, applicationName, type, applicationStartRole, applicationAcceptRole, ApplicationReviewRole, applicationResponseWait, applicationLogChannel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [message.guild.id, random, applicationName, choice, emptyArray, emptyArray, emptyArray, "1 Day", channelid]);

        con.query("INSERT INTO triggertypes (`applicationID`, `guildid`, `trigger`, `alias`) VALUES (?, ?, ?, ?)", [random, message.guild.id, trigger, command]);
        await con.awaitQuery("INSERT INTO questions (`guildID`, `applicationID`, `applicationQuestions`) VALUES (?, ?, ?)", [message.guild.id, random, JSON.stringify(questionArray)]);

        return;
    } else if (starting == emojis[1]) {
        trigger = 2;

        setupMessage.setDescription("Please reply to this message with your messages link that you would like to start the application.");

        message.channel.send({ embed: setupMessage }).catch(c => {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })
        });

        let collected = await message.channel.awaitMessages(m => m.member.id == message.member.id, { max: 1, time: 600000, errors: ['time'] }).catch(c => {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })
        });

        if (!collected) {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })
        }

        collected = collected.first().content.toString();
        collected = collected.split("/");
        let messageID = collected[collected.length - 1];
        let channelID = collected[collected.length - 2];

        let channel = message.guild.channels.cache.get(channelID);
        if (!channel) {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })

        }
        let messages = await channel.messages.fetch(messageID);

        if (!messages) {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })
        }

        setupMessage.setDescription("Please react with the emoji you would like to use");

        let emojiMessage = await message.channel.send({ embed: setupMessage }).catch(c => {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })
        });

        let emoji = await emojiMessage.awaitReactions((reaction, u) => u.id == message.member.id, { max: 1, time: 600000, errors: ["time"] }).catch(c => {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })
        });

        if (!emoji) {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })
        }
        emoji = emoji.first().emoji;

        let emojiName = (emoji.id == null) ? emoji.name : "";
        let emojiId = (emojiName == null) ? emoji.id : "";

        if (emojiId == "") {
            messages.react(emojiName).catch(c => {
                setupMessage.setDescription("There was an error. Please try again")
                return message.channel.send({ embed: setupMessage })
            });
        } else {
            messages.react(message.guild.emojis.cache.get(emojiId)).catch(c => {
                setupMessage.setDescription("There was an error. Please try again")
                return message.channel.send({ embed: setupMessage })
            });
        }

        setupMessage.setDescription("Your application has been setup and is now ready to use!");

        message.channel.send({ embed: setupMessage }).catch(c => {
            setupMessage.setDescription("There was an error. Please try again")
            return message.channel.send({ embed: setupMessage })
        });

        let random = randomString.generate(12);

        let emptyArray = []
        emptyArray = JSON.stringify(emptyArray)

        con.query("INSERT INTO applications (guildID, applicationID, applicationName, type, applicationStartRole, applicationAcceptRole, ApplicationReviewRole, applicationResponseWait, applicationLogChannel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [message.guild.id, random, applicationName, choice, emptyArray, emptyArray, emptyArray, "1 Day", channelid]);

        con.query("INSERT INTO triggertypes (`applicationID`, `guildid`, `trigger`, `triggerChannelId`, `triggerMessageID`, `triggerReaction`, `triggerReactionId`) VALUES (?, ?, ?, ?, ?, ?, ?)", [random, message.guild.id, trigger, channel.id, messages.id, emojiName, emojiId]);

        await con.query("INSERT INTO questions (`guildID`, `applicationID`, `applicationQuestions`) VALUES (?, ?, ?)", [message.guild.id, random, JSON.stringify(questionArray)]);
    } if (starting == emojis[2]) {
        trigger = 3;

        let random = randomString.generate(12);

        let emptyArray = []
        emptyArray = JSON.stringify(emptyArray)

        con.query("INSERT INTO applications (guildID, applicationID, applicationName, type, applicationStartRole, applicationAcceptRole, ApplicationReviewRole, applicationResponseWait, applicationLogChannel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [message.guild.id, random, applicationName, choice, emptyArray, emptyArray, emptyArray, "1 Day", channelid]);

        con.query("INSERT INTO triggertypes (`applicationID`, `guildid`, `trigger`) VALUES (?, ?, ?)", [random, message.guild.id, trigger]);

        await con.query("INSERT INTO questions (`guildID`, `applicationID`, `applicationQuestions`) VALUES (?, ?, ?)", [message.guild.id, random, JSON.stringify(questionArray)]);

        setupMessage.setDescription("This application can now be started by using r/apply")

        message.channel.send(setupMessage);
    }
};
