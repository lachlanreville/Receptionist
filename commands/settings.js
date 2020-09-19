const { MessageEmbed } = require("discord.js");
const { con } = require("../database/connection");

exports.use = async (client, message, args, server) => {

    let perms = false;

    let serverConfigRoles = ""

    let configRoles = JSON.parse(server.configRole)

    if (configRoles.length > 0) {
        configRoles.map(c => {
            serverConfigRoles += "\n<@&" + c + ">"
            if (message.member.roles.cache.has(c)) {
                perms = true;
            }
        })
    }

    let serverReviewRoles = ""

    let reviewerRole = JSON.parse(server.reviewerRole)

    if (reviewerRole.length > 0) {
        reviewerRole.map(c => {
            serverReviewRoles += "\n<@&" + c + ">"
        })
    }

    if (serverReviewRoles == "") serverReviewRoles = "None Set"


    if (message.member.permissions.has("ADMINISTRATOR")) {
        perms = true;
    }

    if (perms != true) {
        return message.channel.send("You do not have permission to run this command")
    }

    if (serverConfigRoles == "") serverConfigRoles = "None Set"

    message.delete({ time: 3000 })

    let masterMessage = null;
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

    let serverPrefix = JSON.parse(server.prefix);
    let prefix = "";

    serverPrefix.map(c => {
        prefix += `\n'${c}'`
    })

    const addEmoji = "✏️";
    const resetEmoji = "🔄";
    const removeEmoji = "❌";
    const backEmoji = "⬅️";

    const pageStructure = {
        'initial': {
            message: "Please choose the corrosponding emoji.",
            fields: [
                { fieldTitle: emojis[0] + " Prefixes:", fieldDescription: "Select this option if you would like to Add/Remove or Reset the Servers Prefixes" },
                { fieldTitle: emojis[1] + " Config Roles:", fieldDescription: "Select this option if you would like to Add/Remove or Reset the Configuration Roles" },
                { fieldTitle: emojis[2] + " Review Roles:", fieldDescription: "Select this option if you would like to Add/Remove or Reset the Master Application Review Roles" },
                { fieldTitle: removeEmoji + " Cancel", fieldDescription: "Select this option to end this session." }
            ],
            buttons: [
                { emojiName: emojis[0], pageName: 'prefix' },
                { emojiName: emojis[1], pageName: 'config' },
                { emojiName: emojis[2], pageName: 'review' },
                { emojiName: removeEmoji, type: "finish" }
            ]
        },
        'prefix': {
            message: "Please choose the corrosponding emoji.",
            fields: [
                { fieldTitle: "Current Prefixes", fieldDescription: `Here is a list of your current prefixes in the server: ${prefix}` },
                { fieldTitle: "**" + addEmoji + "** Add", fieldDescription: "Allows a new prefix to work in your server (Max 5)" },
                { fieldTitle: "**" + resetEmoji + "** Reset", fieldDescription: "Resets the prefix in your server to 'r/'" },
                { fieldTitle: "**" + removeEmoji + "** Remove", fieldDescription: "Removes a pre-existing prefix from your server (cant remove all Prefixes)" },
                { fieldTitle: backEmoji + " Go Back", fieldDescription: "Use this Emoji to head back to the main page" }
            ],
            buttons: [
                { emojiName: addEmoji, type: addPrefix },
                { emojiName: resetEmoji, type: resetPrefix },
                { emojiName: removeEmoji, type: removePrefix },
                { emojiName: backEmoji, pageName: "initial" }
            ]
        },
        'config': {
            message: "Please choose the corrosponding emoji.",
            fields: [
                { fieldTitle: "Current Config Roles", fieldDescription: `Here is a list of all your current Server Configuration Roles: ${serverConfigRoles}` },
                {
                    fieldTitle: "**" + addEmoji + "** Add", fieldDescription: "Adds a new allowed role to modify the bots configuration (Max 3)"
                },
                { fieldTitle: "**" + resetEmoji + "** Reset", fieldDescription: "Resets the allowed roles to modify the bots configuration" },
                {
                    fieldTitle: "**" + removeEmoji + "** Remove", fieldDescription: "Removes an originally allowed role from modifying bots configuration"
                },
                { fieldTitle: backEmoji + " Go Back", fieldDescription: "Use this Emoji to head back to the main page" }
            ],
            buttons: [
                { emojiName: addEmoji, type: addConfigRole },
                { emojiName: resetEmoji, type: resetConfigRole },
                { emojiName: removeEmoji, type: removeConfigRole },
                { emojiName: backEmoji, pageName: "initial" }
            ]
        },
        'review': {
            message: "Please choose the corrosponding emoji.",
            fields: [
                { fieldTitle: "Current Application Reviewer Roles", fieldDescription: `Here is a list of all your current Application Reviewer Roles: ${serverReviewRoles}` },
                { fieldTitle: "**" + addEmoji + "** Add", fieldDescription: "Adds a new Application Reviewer Roles to your server" },
                { fieldTitle: "**" + resetEmoji + "** Reset", fieldDescription: "Resets the Application Reviewer Roles in your server to 'r/'" },
                { fieldTitle: "**" + removeEmoji + "** Remove", fieldDescription: "Removes a Application Reviewer Roles from your server" },
                { fieldTitle: backEmoji + " Go Back", fieldDescription: "Use this Emoji to head back to the main page" }
            ],
            buttons: [
                { emojiName: addEmoji, type: addReviewRole },
                { emojiName: resetEmoji, type: resetReviewRole },
                { emojiName: removeEmoji, type: removeReviewRole },
                { emojiName: backEmoji, pageName: "initial" }
            ]
        }
    }
    let page = args[0] ? args[0].toLowerCase() : 'initial'

    switch (page) {
        case "prefix":
            setPage("prefix")
            break;
        case "config":
            setPage("config")
            break;
        case "review":
            setPage("review")
            break;
        default:
            setPage('initial')
            break
    }


    async function setPage(page) {
        const template = new MessageEmbed()
            .setTitle("Server Settings - " + message.guild.name)
            .setDescription("")
            .setFooter(`Powered by https://receptioni.st`)
            .setColor("#0f4361");

        if (masterMessage != null) {
            masterMessage.reactions.removeAll()
            let newPage = pageStructure[page];

            template.setDescription(newPage.message)
            if (newPage.fields.length > 0) {
                newPage.fields.map((fieldData) => template.addField(fieldData.fieldTitle, fieldData.fieldDescription))
            }

            masterMessage = await masterMessage.edit({ embed: template })
            emojiListen = []
            if (newPage.buttons.length > 0) {
                newPage.buttons.map(buttons => { masterMessage.react(buttons.emojiName); emojiListen.push(buttons.emojiName) })

                let emoji = await masterMessage.awaitReactions((reaction, user) => user.id == message.member.id && emojiListen.includes(reaction.emoji.name), { max: 1, time: 600000 })
                if (!emoji.first()) {
                    masterMessage.delete({ time: 3000 })
                    return message.channel.send("Timed out")
                }
                emoji = emoji.first().emoji.name;
                newPage.buttons.map(buttons => {
                    if (buttons.emojiName == emoji) {
                        if (!buttons.pageName) {
                            if (!buttons.type) {
                                return message.channel.send("Hasnt been setup yet.")
                            }
                            if (buttons.type == "finish") {
                                masterMessage.delete({ time: 3000 });
                                return message.channel.send("Session has ended.")
                            }
                            return buttons.type();
                        } else {
                            return changePage(buttons.pageName)
                        }
                    }
                })
                return;
            }
            return;

        } else {
            let newPage = pageStructure[page];

            template.setDescription(newPage.message)
            newPage.fields.map((fieldData) => template.addField(fieldData.fieldTitle, fieldData.fieldDescription))

            masterMessage = await message.channel.send(template)
            emojiListen = []
            newPage.buttons.map(buttons => { masterMessage.react(buttons.emojiName); emojiListen.push(buttons.emojiName) })

            let emoji = await masterMessage.awaitReactions((reaction, user) => user.id == message.member.id && emojiListen.includes(reaction.emoji.name), { max: 1, time: 600000 })

            if (!emoji.first()) {
                masterMessage.delete({ time: 3000 })
                return message.channel.send("Timed out")
            }

            emoji = emoji.first().emoji.name;
            newPage.buttons.map(buttons => {
                if (buttons.emojiName == emoji) {
                    if (!buttons.pageName) {
                        if (!buttons.type) {
                            return message.channel.send("Hasnt been setup yet.")
                        }
                        if (buttons.type == "finish") {
                            masterMessage.delete({ time: 3000 });
                            return message.channel.send("Session has ended.")
                        }
                        return buttons.type();
                    } else {
                        return changePage(buttons.pageName)
                    }
                }
            })
            return;
        }
    }

    async function changePage(pageName) {
        setPage(pageName)
    }

    async function addPrefix() {
        if (serverPrefix.length > 4) return message.channel.send("There is already 5 prefixes set for this server. Please remove a prefix if you would like to add another.")
        let prefixMsg = await message.channel.send("Please reply with the prefix you would like to add. Max length is 10 Characters")
        let prefixAdd = await message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 600000, errors: ["time"] })

        if (!prefixAdd.first()) {
            masterMessage.delete({ time: 3000 })
            prefixMsg.delete({ time: 3000 })
            return message.channel.send("Timed out")
        }
        let newPrefix = prefixAdd.first().content;
        if (newPrefix == "") {
            return message.channel.send("The Prefix cant be Empty.")
        }

        if (newPrefix.split("").length > 10) return message.channel.send("The prefix length is greater then 10 Characters. So I have ended this session.")
        serverPrefix.push(prefixAdd.first().content)

        con.query("UPDATE servers SET prefix = ? WHERE guildID = ?", [JSON.stringify(serverPrefix), message.guild.id])
        prefixMsg.delete({ time: 3000 })

        masterMessage.delete({ time: 3000 })
        prefixAdd.first().delete({ time: 3000 })

        return message.channel.send(`The Prefix '${newPrefix}' now works in this server.`)
    }

    async function resetPrefix() {
        newPrefix = ["r/"]
        con.query("UPDATE servers SET prefix = ? WHERE guildID = ?", [JSON.stringify(newPrefix), message.guild.id])
        masterMessage.delete({ time: 3000 })
        return message.channel.send("Your prefix has been reset to 'r/'")
    }

    async function removePrefix() {
        if (serverPrefix.length < 2) {
            masterMessage.delete({ time: 3000 })
            return message.channel.send("Cant delete any prefixes as there is only 1 set on this server.")
        }
        let newMsg = await message.channel.send("Please reply with the prefix that you would like to remove from this server.")

        let removePrefix = await message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 600000, errors: ["time"] })

        if (!removePrefix.first()) {
            newMsg.delete({ time: 3000 })
            masterMessage.delete({ time: 3000 })
            return message.channel.send("Timed out")
        }

        removePrefix = removePrefix.first();

        let newPrefixes = serverPrefix.filter(c => {
            return c != removePrefix.content
        }
        );


        con.query("UPDATE servers SET prefix = ? WHERE guildID = ?", [JSON.stringify(newPrefixes), message.guild.id])

        newMsg.delete({ time: 3000 })

        masterMessage.delete({ time: 3000 })
        removePrefix.delete({ time: 3000 })

        return message.channel.send(`If the prefix ${removePrefix} existed in your server, it has been removed.`)

    }

    async function addConfigRole() {
        if (configRoles.length > 2) {
            masterMessage.delete({ time: 3000 })
            return message.channel.send("There is already 3 Config Roles setup for this server.")
        }

        let newMsg = await message.channel.send("Please Tag the Role you would like to Add.")

        let newRole = await message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 600000, errors: ['time'] })

        if (!newRole.first()) return message.channel.send("Timed out")

        newRole = newRole.first();

        if (!newRole.mentions.roles.first()) return message.channel.send("Please tag a role")

        configRoles.push(newRole.mentions.roles.first().id)

        con.query("UPDATE servers SET configRole = ? WHERE guildid = ?", [JSON.stringify(configRoles), message.guild.id])

        masterMessage.delete({ time: 3000 })

        newMsg.delete({ time: 3000 })

        message.channel.send(`Successfully added ${newRole.mentions.roles.first()} to run Configuration Commands `)

        return newRole.delete({ time: 3000 })
    }

    async function resetConfigRole() {

        newConfigRole = []
        con.query("UPDATE servers SET configRole = ? WHERE guildID = ?", [JSON.stringify(newConfigRole), message.guild.id])
        masterMessage.delete({ time: 3000 })
        return message.channel.send("Your Config Roles have been reset.")
    }

    async function removeConfigRole() {
        if (configRoles.length < 1) {
            masterMessage.delete({ time: 3000 })
            return message.channel.send("Cant delete any Configuration Roles as there is none setup.")
        }
        let newMsg = await message.channel.send("Please Tag the Role that you would like to remove. (If you have deleted the Role please Reset your Config Roles)")

        let removeConfig = await message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 600000, errors: ["time"] })

        if (!removeConfig.first()) {
            newMsg.delete({ time: 3000 })
            masterMessage.delete({ time: 3000 })
            return message.channel.send("Timed out")
        }

        removeConfig = removeConfig.first();

        let newConfig = configRoles.filter(c => {
            return c != removeConfig.mentions.roles.first().id
        }
        );


        con.query("UPDATE servers SET configRole = ? WHERE guildID = ?", [JSON.stringify(newConfig), message.guild.id])

        newMsg.delete({ time: 3000 })

        masterMessage.delete({ time: 3000 })
        removeConfig.delete({ time: 3000 })

        return message.channel.send(`If the Role ${removeConfig.mentions.roles.first()} existed in your server, it has been removed.`)

    }

    //fix
    async function addReviewRole() {
        if (reviewerRole.length > 2) {
            masterMessage.delete({ time: 3000 })
            return message.channel.send("There is already 3 Reviewer Roles setup for this server.")
        }

        let newMsg = await message.channel.send("Please Tag the Role you would like to Add.")

        let newRole = await message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 600000, errors: ['time'] })

        if (!newRole.first()) return message.channel.send("Timed out")

        newRole = newRole.first();

        if (!newRole.mentions.roles.first()) return message.channel.send("Please tag a role")

        reviewerRole.push(newRole.mentions.roles.first().id)

        con.query("UPDATE servers SET reviewerRole = ? WHERE guildid = ?", [JSON.stringify(reviewerRole), message.guild.id])

        masterMessage.delete({ time: 3000 })

        newMsg.delete({ time: 3000 })

        message.channel.send(`Successfully added ${newRole.mentions.roles.first()} to Review Applications `)

        return newRole.delete({ time: 3000 })
    }

    async function resetReviewRole() {

        newConfigRole = []
        con.query("UPDATE servers SET reviewerRole = ? WHERE guildID = ?", [JSON.stringify(newConfigRole), message.guild.id])
        masterMessage.delete({ time: 3000 })
        return message.channel.send("Your Reviewer Roles have been reset.")
    }

    async function removeReviewRole() {
        if (reviewerRole.length < 1) {
            masterMessage.delete({ time: 3000 })
            return message.channel.send("Cant delete any Reviewer Roles as there is none setup.")
        }
        let newMsg = await message.channel.send("Please Tag the Role that you would like to remove. (If you have deleted the Role please Reset your Reviewer Roles)")

        let removeConfig = await message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 600000, errors: ["time"] })

        if (!removeConfig.first()) {
            newMsg.delete({ time: 3000 })
            masterMessage.delete({ time: 3000 })
            return message.channel.send("Timed out")
        }

        removeConfig = removeConfig.first();

        let newConfig = reviewerRole.filter(c => {
            return c != removeConfig.mentions.roles.first().id
        }
        );

        con.query("UPDATE servers SET reviewerRole = ? WHERE guildID = ?", [JSON.stringify(newConfig), message.guild.id])

        newMsg.delete({ time: 3000 })

        masterMessage.delete({ time: 3000 })
        removeConfig.delete({ time: 3000 })

        return message.channel.send(`If the Role ${removeConfig.mentions.roles.first()} existed in your server, it has been removed.`)
    }
};