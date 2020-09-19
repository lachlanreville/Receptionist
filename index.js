const fs = require("fs")
const { con } = require('./database/connection')
const { token } = require('./utils/config')
const { applications, reactionApplications, acceptApplication, denyApplication, changePage, reviewApplication } = require('./utils/applications');
const { Client, BaseManager } = require('discord.js')
const { clearDatabase } = require('./utils/functions')
const express = require('express')
const app = express();

const client = new Client();
client.login(token)

client.on("shardReady", async (id) => {
    if (id == 0) {
        clearDatabase();
        setInterval(() => {
            clearDatabase();
        }, 5 * 60 * 1000);
        app.post('/servers/:guildid', async (req, res) => {
            let guildid = req.params.guildid
            let guild = await client.guilds.cache.get(guildid)

            if (!guild) return res.json({ success: false })
            let channels = guild.channels.cache;
            let roles = guild.roles.cache;
            const newChannels = [];
            const newCategories = [];
            const newRoles = [];

            channels.map(c => {
                if (c.type == "text") {
                    newChannels.push({ id: c.id, name: c.name })
                } else if (c.type == "category") {
                    newCategories.push({ id: c.id, name: c.name })
                }
            })

            roles.map(c => {
                newRoles.push({ id: c.id, name: c.name })
            })

            return res.json({ channels: newChannels, categories: newCategories, roles: newRoles })

        })
        app.listen('3000', () => {
            console.log("listening on port 3000")
        })
    }
    console.log("[Receptionist] Shard " + id + " is online!")
})

client.on("shardDisconnect", (stop, id) => {
    console.log('[Receptionist] ' + id + ' is offline.')
})
client.on("shardReconnecting", (id) => console.log(`Shard ${id} is rebooting..`))


client.commands = new Map();

async function getCommands() {
    client.commands.clear();
    client.commands.set("resetCommands", { reset: getCommands })

    fs.readdir('./commands/', (err, files) => {
        if (err) return;
        files.map(c => {
            c = c.split(".");

            let path = './commands/' + c[0] + ".js"

            delete require.cache[require.resolve(path)];

            let command = require(`./commands/${c[0]}`);
            client.commands.set(c[0], command);
        })
    })
}

getCommands()

client.on("guildCreate", async guild => {

    let data = await con.awaitQuery("SELECT guildID FROM servers WHERE guildID = ?", [guild.id]);

    if (data.length > 0) return;

    let prefix = ["r/"]
    let everythingelse = []
    return con.query("INSERT INTO servers (guildID, prefix, configRole, reviewerRole) VALUES(?, ?, ?, ?)", [guild.id, JSON.stringify(prefix), JSON.stringify(everythingelse), JSON.stringify(everythingelse)])
})

client.on("message", async (message) => {
    if (message.author.bot) return;
    if (message.author.id == client.user.id) return;

    if (message.channel.type == "dm") {

    } else {

        let data = await con.awaitQuery("SELECT prefix, premium, configRole, reviewerRole FROM servers WHERE guildid = ?", [message.guild.id])
        if (data.length < 1) {
            let prefix = ["r/"]
            let everythingelse = []
            con.query("INSERT INTO servers (guildID, prefix, configRole, reviewerRole) VALUES(?, ?, ?, ?)", [message.guild.id, JSON.stringify(prefix), JSON.stringify(everythingelse), JSON.stringify(everythingelse)])
            return;
        }

        data = data[0];

        let prefixArray = ["<@697932571601797130>", "<@!697932571601797130>"];

        let newPrefixs = JSON.parse(data.prefix)

        newPrefixs.map(c => prefixArray.push(c))

        let prefix;

        prefixArray.map(c => {
            if (message.content.startsWith(c)) prefix = c;
        })
        if (!prefix) return;

        let args = message.content.slice(prefix.length).trim().split(/ +/g);

        let command = args.shift().toLowerCase();
        if (command == "") command = "help";

        if (client.commands.has(command)) {

            client.commands.get(command).use(client, message, args, data)

        } else {

            let commands = await con.awaitQuery("SELECT applicationID FROM `triggertypes` WHERE `trigger` = 1 AND `enabled` = 1 AND `guildid` = ? AND `alias` = ?", [message.guild.id, command])
            if (commands.length < 1) {
                return;
            }

            applications(commands[0].applicationID, message.guild.id, message, data)

        }
    }
})

client.ws.on("MESSAGE_REACTION_ADD", async (reaction) => {
    if (reaction.user_id == client.user.id) return;
    if (!reaction.guild_id) return;

    let reactionGuild = client.guilds.cache.get(reaction.guild_id);
    if (!reactionGuild) return;
    let user = await reactionGuild.members.fetch(reaction.user_id);
    if (!user) return;

    let emojiName = (reaction.emoji.id == null) ? reaction.emoji.name : "";
    let emojiId = (reaction.emoji.name == null) ? reaction.emoji.id : "";

    let channel = reactionGuild.channels.cache.get(reaction.channel_id);

    let reactionMessage = channel.messages.cache.has(reaction.message_id) ? channel.messages.cache.get(reaction.message_id) : await channel.messages.fetch(reaction.message_id)
    let data = await con.awaitQuery("SELECT applicationID, triggerReaction, triggerReactionId from `triggertypes` WHERE `trigger` = 2 AND `enabled` = 1 AND guildid = ? AND triggerChannelID = ? AND triggerMessageID = ? AND triggerReaction = ? AND triggerReactionID = ?", [reaction.guild_id, reaction.channel_id, reaction.message_id, emojiName, emojiId])
    if (data.length < 1) {
        let responseData = await con.awaitQuery("SELECT responses, applicationId, authorId, appliedTime, page, reviewed, responseId FROM responses WHERE guildId = ? AND messageChannelId = ? and messageId = ?", [reaction.guild_id, reaction.channel_id, reaction.message_id])

        if (responseData.length < 1) return;
        let newReaction = reactionMessage.reactions.cache.get((emojiName != "") ? emojiName : emojiId)
        try {
            newReaction.users.remove(user)
        }
        catch (err) {
            //do nothingggggggggggg
        }

        responseData = responseData[0];

        if (reaction.emoji.name == "✅") {
            acceptApplication(reaction, responseData, reactionGuild, user)
        } else if (reaction.emoji.name == "❌") {
            denyApplication(reaction, responseData, reactionGuild, user)
        } else if (reaction.emoji.name == "➡️") {
            changePage(reaction, responseData, reactionGuild, reactionMessage, channel, user, type = "forward")
        } else if (reaction.emoji.name == "⬅️") {
            changePage(reaction, responseData, reactionGuild, reactionMessage, channel, user, type = "backwards")
        } else if (reaction.emoji.name == "📄") {
            reviewApplication(reaction, responseData, reactionGuild, channel, user)
        }

    } else {
        let newReaction = reactionMessage.reactions.cache.get((emojiName != "") ? emojiName : emojiId)
        try {
            newReaction.users.remove(user)
        }
        catch (err) {
            //do nothingggggggggggg
        }
        let applicationProcess;
        data.map(c => {
            if (c.triggerReaction == emojiName && c.triggerReactionId == "") {
                applicationProcess = c;
            }
            if (c.triggerReactionId == emojiId && c.triggerReaction == '') {
                applicationProcess = c;
            }
        })

        reactionApplications(applicationProcess.applicationID, reaction, client, reactionGuild, user.user)
    }
})

client.on("debug", console.log)
process.on("uncaughtException", console.log)