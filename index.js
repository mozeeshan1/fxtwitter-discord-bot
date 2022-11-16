const Config = require("./config.json");
const fs = require("fs");
const pako = require("pako");

const { Client, GatewayIntentBits, SlashCommandBuilder, Events, REST, Routes, PermissionFlagsBits, roleMention, userMention } = require("discord.js");
const { log } = require("console");
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildIntegrations, GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildPresences],
});
const rest = new REST({ version: "10" }).setToken(Config["TOKEN"]);
const pingCommand = new SlashCommandBuilder().setName("ping").setDescription("Replies with pong");
const mentionRemoveCommand = new SlashCommandBuilder()
  .setName("mention")
  .setDescription("Mention command")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("remove")
      .setDescription("Edit or view the mention remove list. Any mentions in this list will be removed from bot reply.")
      .addStringOption((option) => option.setName("action").setDescription("The action to be performed").setRequired(true).addChoices({ name: "add", value: "add" }, { name: "remove", value: "remove" }, { name: "list", value: "list" }, { name: "clear", value: "clear" }))
      .addMentionableOption((mention) => mention.setName("mention").setDescription("The tag you want to add or remove. Does nothing for list."))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("removeall")
      .setDescription("Toggle user, role or all mentions.")
      .addStringOption((option) => option.setName("groups").setDescription("The groups to removed.").setRequired(true).addChoices({ name: "all", value: "all" }, { name: "roles", value: "roles" }, { name: "users", value: "users" }))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// make message collector for interaction reply
let tempMessage = null;
let removeMentionPresent = {};
let userList = {};
let roleList = {};

client.on("messageCreate", async (msg) => {
  try {
    if (msg.webhookId) return;
    // console.log(msg.content);
    tempMessage = msg;
    if (msg.content === "ping") {
      msg.reply("pong");
    }
    if (msg.content.match(/http(s)*:\/\/(www.)*(mobile.)*twitter.com/gi)) {
      let vxMsg = msg.content.replace(/mobile.twitter/g, "twitter").replace(/twitter/g, "fxtwitter");
      let msgAttachments = [];
      let allowedMentionsObject = { parse: ["everyone", "roles", "users"], users: userList[msg.guildId], roles: roleList[msg.guildId] };
      if (removeMentionPresent[msg.guildId]) {
        let removeFile = {};
        try {
          removeFile = JSON.parse(pako.inflate(fs.readFileSync("remove-lists.txt"), { to: "string" }));
        } catch (err) {
          console.log("Error in replacing link file read  ", err.code);
        }
        let tempRemoveObject = removeFile[msg.guildId];

        if (tempRemoveObject.all.length > 0 && tempRemoveObject.mentions.length > 0) {
          for (let allElem of tempRemoveObject.all) {
            if (allElem === "all") {
              allowedMentionsObject.parse = [];
              break;
            } else if (allElem === "roles") {
              allowedMentionsObject.parse.splice(allowedMentionsObject.parse.indexOf("roles"), 1);
              allowedMentionsObject.roles = [];
            } else if (allElem === "users") {
              allowedMentionsObject.parse.splice(allowedMentionsObject.parse.indexOf("users"), 1);
              allowedMentionsObject.users = [];
            }
          }

          for (let mentionsElem of tempRemoveObject.mentions) {
            if (mentionsElem.type === "everyone") {
              allowedMentionsObject.parse.splice(allowedMentionsObject.parse.indexOf("everyone"), 1);
            } else if (mentionsElem.type === "role") {
              allowedMentionsObject.roles.splice(allowedMentionsObject.roles.indexOf(mentionsElem.data), 1);
            } else if (mentionsElem.type === "user") {
              allowedMentionsObject.users.splice(allowedMentionsObject.users.indexOf(mentionsElem.data), 1);
            }
          }
          if (allowedMentionsObject.parse.length === 0) {
            allowedMentionsObject.roles = [];
            allowedMentionsObject.users = [];
          }
          if (allowedMentionsObject.parse.includes("roles") && !tempRemoveObject.mentions.some((elem) => elem.type === "role")) {
            allowedMentionsObject.roles = [];
          } else if (allowedMentionsObject.parse.includes("roles") && tempRemoveObject.mentions.some((elem) => elem.type === "role")) {
            allowedMentionsObject.parse.splice(allowedMentionsObject.parse.indexOf("roles"), 1);
          }
          if (allowedMentionsObject.parse.includes("users") && !tempRemoveObject.mentions.some((elem) => elem.type === "user")) {
            allowedMentionsObject.users = [];
          } else if (allowedMentionsObject.parse.includes("users") && tempRemoveObject.mentions.some((elem) => elem.type === "user")) {
            allowedMentionsObject.parse.splice(allowedMentionsObject.parse.indexOf("users"), 1);
          }
        } else if (tempRemoveObject.all.length > 0) {
          for (let allElem of tempRemoveObject.all) {
            if (allElem === "all") {
              allowedMentionsObject.parse = [];
              break;
            } else if (allElem === "roles") {
              allowedMentionsObject.parse.splice(allowedMentionsObject.parse.indexOf("roles"), 1);
              allowedMentionsObject.roles = [];
            } else if (allElem === "users") {
              allowedMentionsObject.parse.splice(allowedMentionsObject.parse.indexOf("users"), 1);
              allowedMentionsObject.users = [];
            }
          }
          if (allowedMentionsObject.parse.length === 0) {
            allowedMentionsObject.roles = [];
            allowedMentionsObject.users = [];
          }
          if (allowedMentionsObject.parse.includes("roles")) {
            allowedMentionsObject.roles = [];
          }
          if (allowedMentionsObject.parse.includes("users")) {
            allowedMentionsObject.users = [];
          }
        } else if (tempRemoveObject.mentions.length > 0) {
          for (let mentionsElem of tempRemoveObject.mentions) {
            if (mentionsElem.type === "everyone") {
              allowedMentionsObject.parse.splice(allowedMentionsObject.parse.indexOf("everyone"), 1);
            } else if (mentionsElem.type === "role") {
              allowedMentionsObject.roles.splice(allowedMentionsObject.roles.indexOf(mentionsElem.data), 1);
            } else if (mentionsElem.type === "user") {
              allowedMentionsObject.users.splice(allowedMentionsObject.users.indexOf(mentionsElem.data), 1);
            }
          }
          if (allowedMentionsObject.parse.includes("roles") && !tempRemoveObject.mentions.some((elem) => elem.type === "role")) {
            allowedMentionsObject.roles = [];
          } else if (allowedMentionsObject.parse.includes("roles") && tempRemoveObject.mentions.some((elem) => elem.type === "role")) {
            allowedMentionsObject.parse.splice(allowedMentionsObject.parse.indexOf("roles"), 1);
          }
          if (allowedMentionsObject.parse.includes("users") && !tempRemoveObject.mentions.some((elem) => elem.type === "user")) {
            allowedMentionsObject.users = [];
          } else if (allowedMentionsObject.parse.includes("users") && tempRemoveObject.mentions.some((elem) => elem.type === "user")) {
            allowedMentionsObject.parse.splice(allowedMentionsObject.parse.indexOf("users"), 1);
          }
        }else{
          if (allowedMentionsObject.parse.includes("roles") && !tempRemoveObject.mentions.some((elem) => elem.type === "role")) {
            allowedMentionsObject.roles = [];
          } else if (allowedMentionsObject.parse.includes("roles") && tempRemoveObject.mentions.some((elem) => elem.type === "role")) {
            allowedMentionsObject.parse.splice(allowedMentionsObject.parse.indexOf("roles"), 1);
          }
          if (allowedMentionsObject.parse.includes("users") && !tempRemoveObject.mentions.some((elem) => elem.type === "user")) {
            allowedMentionsObject.users = [];
          } else if (allowedMentionsObject.parse.includes("users") && tempRemoveObject.mentions.some((elem) => elem.type === "user")) {
            allowedMentionsObject.parse.splice(allowedMentionsObject.parse.indexOf("users"), 1);
          }
        }
      }
      else{

          allowedMentionsObject.roles = [];
          allowedMentionsObject.users = [];
      }


      for (let attch of msg.attachments) {
        msgAttachments.push(attch[1].url);
      }
      if (msg.channel.type === 10 || msg.channel.type === 11 || msg.channel.type === 12) {
        client.guilds.cache
          .get(msg.guildId)
          .channels.fetchWebhooks(msg.channel.parentId)
          .then((webhooks) => {
            let webhookNumber = 0;
            webhooks.forEach((webhook) => {
              if (webhook.name === "VxT 1" || webhook.name === "VxT 2") {
                webhookNumber++;
              }
            });

            if (webhookNumber === 2) {
              let webhook = getRandomItem(webhooks)[1];
              webhook.send({
                content: vxMsg,
                username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName,
                avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL(),
                threadId: msg.channelId,
                files: msgAttachments,
                allowedMentions: allowedMentionsObject,
              });
              msg.delete();
            } else if (webhookNumber === 1) {
              msg.guild.channels
                .createWebhook({ channel: msg.channel.parentId, name: "VxT 2" })
                .then((webhook) => {
                  webhook.send({
                    content: vxMsg,
                    username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName,
                    avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL(),
                    threadId: msg.channelId,
                    files: msgAttachments,
                    allowedMentions: allowedMentionsObject,
                  });
                  msg.delete();
                })
                .catch(console.error);
            } else if (webhookNumber === 0) {
              msg.guild.channels
                .createWebhook({ channel: msg.channel.parentId, name: "VxT 1" })
                .then((webhook) => {
                  webhook.send({
                    content: vxMsg,
                    username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName,
                    avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL(),
                    threadId: msg.channelId,
                    files: msgAttachments,
                    allowedMentions: allowedMentionsObject,
                  });
                  msg.delete();
                })
                .catch(console.error);
            } else {
              console.log("IN ELSE LOOP");
            }
          });
        return;
      }
      msg.channel.fetchWebhooks().then((webhooks) => {
        let webhookNumber = 0;
        webhooks.forEach((webhook) => {
          if (webhook.name === "VxT 1" || webhook.name === "VxT 2") {
            webhookNumber++;
          }
        });

        if (webhookNumber === 2) {
          let webhook = getRandomItem(webhooks)[1];
          webhook.send({
            content: vxMsg,
            username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName,
            avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL(),
            files: msgAttachments,
            allowedMentions: allowedMentionsObject,
          });
          msg.delete();
        } else if (webhookNumber === 1) {
          msg.channel
            .createWebhook({ name: "VxT 2" })
            .then((webhook) => {
              webhook.send({
                content: vxMsg,
                username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName,
                avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL(),
                files: msgAttachments,
                allowedMentions: allowedMentionsObject,
              });
              msg.delete();
            })
            .catch(console.error);
        } else if (webhookNumber === 0) {
          msg.channel
            .createWebhook({ name: "VxT 1" })
            .then((webhook) => {
              webhook.send({
                content: vxMsg,
                username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName,
                avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL(),
                files: msgAttachments,
                allowedMentions: allowedMentionsObject,
              });
              msg.delete();
            })
            .catch(console.error);
        } else {
          console.log("IN ELSE LOOP");
        }
      });
    }
  } catch (e) {
    console.log("ERROR OCCURRED");
    console.log(e);
  }
});


client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply({ content: "Pong!" });
    return;
  }
  const filter = (tempMessage) => tempMessage.author.id === interaction.user.id;
  const collector = interaction.channel.createMessageCollector(filter, { max: 1, time: 15000 });
  collector.once("collect", async (message) => {
    removeMentionPresent[message.guildId] = CheckRemoveMentions(message.guildId);
  });

  if (interaction.commandName === "mention" && interaction.options.getSubcommand() === "remove") {
    let action = interaction.options.getString("action");
    let mention = {};
    let tempMentionable = interaction.options.getMentionable("mention");
    let interactionGuildID = interaction.guildId;
    if (tempMentionable) {
      if (tempMentionable.user) {
        mention.type = "user";
        mention.data = tempMentionable.user.id;
      } else if (tempMentionable.name === "@everyone") {
        mention.type = "everyone";
        mention.data = ["@everyone", "@here"];
      } else {
        mention.type = "role";
        mention.data = tempMentionable.id;
      }
    }
    if (action === "list") {
      let removeFile = {};
      let mentionsArray = [];
      try {
        removeFile = JSON.parse(pako.inflate(fs.readFileSync("remove-lists.txt"), { to: "string" }));
        let tempRemoveObject = removeFile[interactionGuildID];
        if (typeof tempRemoveObject === "undefined" || typeof tempRemoveObject === null || ((!tempRemoveObject.mentions || tempRemoveObject.mentions.length === 0) && (!tempRemoveObject.all || tempRemoveObject.all.length === 0))) {
          await interaction.reply({ content: "No mentions registered for server." });
          return;
        } else if (tempRemoveObject.all.length === 3 || tempRemoveObject.all.includes("all") || (tempRemoveObject.all.length === 2 && !tempRemoveObject.all.includes("all") && tempRemoveObject.mentions.some((elem) => elem.type === "everyone"))) {
          mentionsArray = ["All mentions are removed."];
          mentionsString = mentionsArray.join(",");
        } else if (tempRemoveObject.all.length === 2 && !tempRemoveObject.all.includes("all")) {
          mentionsArray = ["All user and role mentions are removed."];
        } else {
          for (let elem of tempRemoveObject.mentions) {
            switch (elem.type) {
              case "everyone":
                mentionsArray.push(...elem.data);
                break;
              case "role":
                if (tempRemoveObject.all.includes("roles")) {
                  break;
                }
                mentionsArray.push(roleMention(elem.data));
                break;
              case "user":
                if (tempRemoveObject.all.includes("users")) {
                  break;
                }
                mentionsArray.push(userMention(elem.data));
                break;
              default:
                console.log("Not a normal data type in list action");
            }
          }
          let mentionsString = "";
          if (tempRemoveObject.all.includes("roles")) {
            mentionsString = "All role mentions are removed. ".concat(mentionsArray.join(","));
          } else if (tempRemoveObject.all.includes("users")) {
            mentionsString = "All user mentions are removed. ".concat(mentionsArray.join(","));
          } else {
            mentionsString = mentionsArray.join(",");
          }

          await interaction.reply({ content: mentionsString });
          return;
        }
        await interaction.reply({ content: mentionsArray.join(",") });
        return;
      } catch (err) {
        if (err.code === "ENOENT") {
          await interaction.reply({ content: "No mentions registered for server." });
          return;
        }
      }
    } else if (action === "add") {
      let removeFile = {};
      try {
        removeFile = JSON.parse(pako.inflate(fs.readFileSync("remove-lists.txt"), { to: "string" }));
      } catch (err) {
        console.log("Error in add read file sync", err.code);
      }

      if (Object.keys(mention).length > 0) {
        let tempRemoveObject = [];
        if (removeFile[interactionGuildID]) {
          if (removeFile[interactionGuildID].all) {
            tempRemoveObject = removeFile[interactionGuildID].mentions;
          } else if (typeof removeFile[interactionGuildID].all === "undefined" && typeof removeFile[interactionGuildID].mentions === "undefined" && typeof removeFile[interactionGuildID].all === null && typeof removeFile[interactionGuildID].mentions === null) {
            removeFile[interactionGuildID] = { all: [], mentions: [] };
          } else {
            removeFile[interactionGuildID] = { all: removeFile[interactionGuildID].all, mentions: [] };
          }
        } else {
          removeFile[interactionGuildID] = { all: [], mentions: [] };
        }

        if (tempRemoveObject) {
          if (tempRemoveObject.some((elem) => JSON.stringify(elem) === JSON.stringify(mention))) {
            await interaction.reply({ content: "Mention already exists" });
            return;
          } else if (mention.type === "everyone") {
            tempRemoveObject.unshift(mention);
          } else {
            tempRemoveObject.push(mention);
          }
        } else {
          tempRemoveObject = [mention];
        } //add mention object and use that object everywhere. or think about it. you could prob easily filter users, roles and everyone with it so
        removeFile[interactionGuildID].mentions = tempRemoveObject;
      } else {
        await interaction.reply({ content: "Please select a mention." });
        return;
      }

      fs.writeFile("remove-lists.txt", pako.deflate(JSON.stringify(removeFile)), { encoding: "utf8" }, async (err) => {
        if (err) {
          console.log("error in file writing in add    ", err.code);
        } else {
          switch (mention.type) {
            case "everyone":
              await interaction.reply({ content: `Added ${mention.data}` });
              break;
            case "role":
              await interaction.reply({ content: `Added ${roleMention(mention.data)}` });
              break;
            case "user":
              await interaction.reply({ content: `Added ${userMention(mention.data)}` });
              break;
            default:
              await interaction.reply({ content: `Added mention` });
          }
        }
      });
    } else if (action === "remove") {
      let removeFile = {};
      try {
        removeFile = JSON.parse(pako.inflate(fs.readFileSync("remove-lists.txt"), { to: "string" }));
      } catch (err) {
        console.log("Error in remove read file sync", err.code);
        if (err.code === "ENOENT") {
          await interaction.reply({ content: "No mentions registered for server." });
          return;
        }
      }
      if (!removeFile[interactionGuildID] || !removeFile[interactionGuildID].mentions || removeFile[interactionGuildID].mentions.length === 0) {
        await interaction.reply({ content: "No mentions registered for server." });
        return;
      }

      if (Object.keys(mention).length > 0) {
        let tempRemoveObject = removeFile[interactionGuildID].mentions;
        let mentionRemoved = false;

        for (let i = 0; i < tempRemoveObject.length; i++) {
          if (JSON.stringify(tempRemoveObject[i]) === JSON.stringify(mention)) {
            tempRemoveObject.splice(i, 1);
            mentionRemoved = true;
            break;
          }
        }
        if (!mentionRemoved) {
          await interaction.reply({ content: "Mention does not exist in list." });
          return;
        }
        removeFile[interactionGuildID].mentions = tempRemoveObject;
      } else {
        await interaction.reply({ content: "Please select a mention." });
        return;
      }
      fs.writeFile("remove-lists.txt", pako.deflate(JSON.stringify(removeFile)), { encoding: "utf8" }, async (err) => {
        if (err) {
          console.log("error in file writing in remove    ", err.code);
        } else {
          switch (mention.type) {
            case "everyone":
              await interaction.reply({ content: `Removed ${mention.data}` });
              break;
            case "role":
              await interaction.reply({ content: `Removed ${roleMention(mention.data)}` });
              break;
            case "user":
              await interaction.reply({ content: `Removed ${userMention(mention.data)}` });
              break;
            default:
              await interaction.reply({ content: `Removed mention` });
          }
        }
      });
    } else if (action === "clear") {
      let removeFile = {};
      try {
        removeFile = JSON.parse(pako.inflate(fs.readFileSync("remove-lists.txt"), { to: "string" }));
      } catch (err) {
        console.log("Error in clear read file sync", err.code);
        if (err.code === "ENOENT") {
          await interaction.reply({ content: "No mentions registered for server." });
          return;
        }
      }
      if (!removeFile[interactionGuildID] || !removeFile[interactionGuildID].mentions || removeFile[interactionGuildID].mentions.length === 0) {
        await interaction.reply({ content: "No mentions registered for server." });
        return;
      }
      removeFile[interactionGuildID].mentions = [];
      fs.writeFile("remove-lists.txt", pako.deflate(JSON.stringify(removeFile)), { encoding: "utf8" }, async (err) => {
        if (err) {
          console.log("error in file writing in clear    ", err.code);
        } else {
          await interaction.reply({ content: `Removed all mentions.` });
        }
      });
    }
  }
  if (interaction.commandName === "mention" && interaction.options.getSubcommand() === "removeall") {
    let groups = interaction.options.getString("groups");
    let interactionGuildID = interaction.guildId;
    if (groups === "all") {
      let removeFile = {};
      let tempAllArray = [];
      try {
        removeFile = JSON.parse(pako.inflate(fs.readFileSync("remove-lists.txt"), { to: "string" }));
      } catch (err) {
        console.log("Error in all read file sync", err.code);
      }
      if (removeFile[interactionGuildID]) {
        if (removeFile[interactionGuildID].all) {
          tempAllArray = removeFile[interactionGuildID].all;
        } else if (typeof removeFile[interactionGuildID].all === "undefined" && typeof removeFile[interactionGuildID].mentions === "undefined" && typeof removeFile[interactionGuildID].all === null && typeof removeFile[interactionGuildID].mentions === null) {
          removeFile[interactionGuildID] = { all: [], mentions: [] };
        } else {
          removeFile[interactionGuildID] = { all: [], mentions: removeFile[interactionGuildID].mentions };
        }
      } else {
        removeFile[interactionGuildID] = { all: [], mentions: [] };
      }

      if (tempAllArray.includes("all")) {
        let indexAll = tempAllArray.indexOf("all");
        tempAllArray.splice(indexAll, 1);
      } else {
        tempAllArray.push("all");
      }

      removeFile[interactionGuildID].all = tempAllArray;
      fs.writeFile("remove-lists.txt", pako.deflate(JSON.stringify(removeFile)), { encoding: "utf8" }, async (err) => {
        if (err) {
          console.log("error in file writing in all    ", err.code);
        } else {
          await interaction.reply({ content: `Toggled all mention ${tempAllArray.includes("all") ? `on` : `off`}` });
        }
      });
    } else if (groups === "roles") {
      let removeFile = {};
      let tempAllArray = [];
      try {
        removeFile = JSON.parse(pako.inflate(fs.readFileSync("remove-lists.txt"), { to: "string" }));
      } catch (err) {
        console.log("Error in roles read file sync", err.code);
      }
      if (removeFile[interactionGuildID]) {
        if (removeFile[interactionGuildID].all) {
          tempAllArray = removeFile[interactionGuildID].all;
        } else if (typeof removeFile[interactionGuildID].all === "undefined" && typeof removeFile[interactionGuildID].mentions === "undefined" && typeof removeFile[interactionGuildID].all === null && typeof removeFile[interactionGuildID].mentions === null) {
          removeFile[interactionGuildID] = { all: [], mentions: [] };
        } else {
          removeFile[interactionGuildID] = { all: [], mentions: removeFile[interactionGuildID].mentions };
        }
      } else {
        removeFile[interactionGuildID] = { all: [], mentions: [] };
      }
      if (tempAllArray.includes("roles")) {
        let indexAll = tempAllArray.indexOf("roles");
        tempAllArray.splice(indexAll, 1);
      } else {
        tempAllArray.push("roles");
      }
      removeFile[interactionGuildID].all = tempAllArray;
      fs.writeFile("remove-lists.txt", pako.deflate(JSON.stringify(removeFile)), { encoding: "utf8" }, async (err) => {
        if (err) {
          console.log("error in file writing in roles    ", err.code);
        } else {
          await interaction.reply({ content: `Toggled role mention ${tempAllArray.includes("roles") ? `on` : `off`}` });
        }
      });
    } else if (groups === "users") {
      let removeFile = {};
      let tempAllArray = [];
      try {
        removeFile = JSON.parse(pako.inflate(fs.readFileSync("remove-lists.txt"), { to: "string" }));
      } catch (err) {
        console.log("Error in users read file sync", err.code);
      }
      if (removeFile[interactionGuildID]) {
        if (removeFile[interactionGuildID].all) {
          tempAllArray = removeFile[interactionGuildID].all;
        } else if (typeof removeFile[interactionGuildID].all === "undefined" && typeof removeFile[interactionGuildID].mentions === "undefined" && typeof removeFile[interactionGuildID].all === null && typeof removeFile[interactionGuildID].mentions === null) {
          removeFile[interactionGuildID] = { all: [], mentions: [] };
        } else {
          removeFile[interactionGuildID] = { all: [], mentions: removeFile[interactionGuildID].mentions };
        }
      } else {
        removeFile[interactionGuildID] = { all: [], mentions: [] };
      } //CONTINUE FROM HERE CHECK IF THIS EXISTS AND THE ADD ALL AND STUFF TO IT
      if (tempAllArray.includes("users")) {
        let indexAll = tempAllArray.indexOf("users");
        tempAllArray.splice(indexAll, 1);
      } else {
        tempAllArray.push("users");
      }
      removeFile[interactionGuildID].all = tempAllArray;
      fs.writeFile("remove-lists.txt", pako.deflate(JSON.stringify(removeFile)), { encoding: "utf8" }, async (err) => {
        if (err) {
          console.log("error in file writing in users    ", err.code);
        } else {
          await interaction.reply({ content: `Toggled user mention ${tempAllArray.includes("users") ? `on` : `off`}` });
        }
      });
    }
  }
});
client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.user.setActivity(+client.guilds.cache.size > 1 ? `Currently in ${client.guilds.cache.size} servers` : `Currently in ${client.guilds.cache.size} server`);
  client.guilds.cache.forEach((guild) => (removeMentionPresent[guild.id] = CheckRemoveMentions(guild.id)));
});
// client.on("debug", ( e ) => console.log(e));
client.login(Config["TOKEN"]);

function CheckRemoveMentions(GID) {
  const guild = client.guilds.cache.get(GID);
  userList[GID] = guild.members.cache.map((member) => {
    return member.id;
  });
  roleList[GID] = guild.roles.cache.map((role) => {
    return role.id;
  });

  let removeFile = {};
  try {
    removeFile = JSON.parse(pako.inflate(fs.readFileSync("remove-lists.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in CheckRemoveMention function", err.code);
  }
  if (removeFile[GID]) {
    if (removeFile[GID].all && removeFile[GID].mentions) {
      if (removeFile[GID].all.length > 0 || removeFile[GID].mentions.length > 0) {
        return true;
      } else {
        return false;
      }
    } else if (removeFile[GID].all) {
      if (removeFile[GID].all.length > 0) {
        return true;
      } else {
        return false;
      }
    } else if (removeFile[GID].mentions) {
      if (removeFile[GID].mentions.length > 0) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  } else {
    return false;
  }
}

function getRandomItem(set) {
  let items = Array.from(set);
  let filtereditems = items.filter((elem) => {
    return elem[1].name === "VxT 1" || elem[1].name === "VxT 2";
  });
  return filtereditems[Math.floor(Math.random() * filtereditems.length)];
}
//registering slash commands here
(async () => {
  try {
    const data = await rest.put(Routes.applicationCommands(Config["Client ID"]), { body: [pingCommand, mentionRemoveCommand] });
    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();
