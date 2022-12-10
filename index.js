const Config = require("./config.json");
const fs = require("fs");
const pako = require("pako");

const { Client, GatewayIntentBits, SlashCommandBuilder, Events, REST, Routes, PermissionFlagsBits, roleMention, userMention } = require("discord.js");
const { log } = require("console");
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildIntegrations, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences],
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
const fxToggleCommand = new SlashCommandBuilder()
  .setName("toggle")
  .setDescription("Convert links for tweets including. On by default.")
  .addStringOption((option) => option.setName("type").setDescription("The types of tweets to be converted").setRequired(true).addChoices({ name: "text", value: "text" }, { name: "photos", value: "photos" }, { name: "videos", value: "videos" }, { name: "polls", value: "polls" }, { name: "all", value: "all" }))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const messageControlCommand = new SlashCommandBuilder()
  .setName("message")
  .setDescription("Control message behaviour.")
  .addSubcommand((subcommand) => subcommand.setName("deleteoriginal").setDescription("Toggle the deletion of the original message. On by default."))
  .addSubcommand((subcommand) => subcommand.setName("otherwebhooks").setDescription("Toggle operation on webhooks from other bots. Off by default."))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const globalCommandsBody = [pingCommand, mentionRemoveCommand, fxToggleCommand, messageControlCommand];

// make message collector for interaction reply
let tempMessage = null;
let removeMentionPresent = {};
let userList = {};
let roleList = {};
let messageControlList = {};

client.on("messageCreate", async (msg) => {
  try {
    // console.log(msg.content);
    if (messageControlList.hasOwnProperty(msg.guildId)&&messageControlList[msg.guildId].hasOwnProperty("otherWebhooks") && msg.webhookId && msg.type !== 20 && (await msg.fetchWebhook()).owner.id === client.user.id) return;
    else if ((!messageControlList.hasOwnProperty(msg.guildId)||!messageControlList[msg.guildId].hasOwnProperty("otherWebhooks")) && msg.webhookId) return;
    tempMessage = msg;
    if (msg.content === "ping") {
      msg.reply("pong");
    }
    if (msg.content.match(/http(s)*:\/\/(www\.)*(mobile\.)*twitter.com/gi)) {
      let vxMsg = msg.content;
      let msgAttachments = [];
      let allowedMentionsObject = { parse: [] };

      let toggleFile = {};
      try {
        toggleFile = JSON.parse(pako.inflate(fs.readFileSync("toggle-list.txt"), { to: "string" }));
      } catch (err) {
        console.log("Error in text read file sync msg toggle", err.code);
      }
      let toggleObj = toggleFile[msg.guildId];
      if (Object.values(toggleObj).every((val) => val === false)) {
        return;
      } else if (Object.values(toggleObj).some((val) => val === false)) {
        let twitterLinks = msg.content.match(/(http(s)*:\/\/(www\.)?(mobile\.)?(twitter.com)\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/gim);
        let replaceTwitterLinks = [];
        for (let i of twitterLinks) {
          let j = i.substr(i.indexOf("status/") + 7);
          let fxAPIUrl = "https://api.fxtwitter.com/status/".concat(j);
          await fetch(fxAPIUrl)
            .then((response) => {
              return response.json();
            })
            .then((data) => {
              if (data.tweet.hasOwnProperty("media")) {
                if (data.tweet.media.hasOwnProperty("photos") && toggleObj.photos) {
                  replaceTwitterLinks.push(i);
                } else if (data.tweet.media.hasOwnProperty("videos") && toggleObj.videos) {
                  replaceTwitterLinks.push(i);
                }
              } else if (data.tweet.hasOwnProperty("poll") && toggleObj.polls) {
                replaceTwitterLinks.push(i);
              } else if (!(data.tweet.hasOwnProperty("media") || data.tweet.hasOwnProperty("poll")) && toggleObj.text) {
                replaceTwitterLinks.push(i);
              }
            });
        }
        for (let j of replaceTwitterLinks) {
          let tempFXLink = j.replace(/mobile.twitter/g, "twitter").replace(/twitter/g, "fxtwitter");
          vxMsg = vxMsg.replaceAll(j, tempFXLink);
        }
      } else {
        vxMsg = vxMsg.replace(/mobile.twitter/g, "twitter").replace(/twitter/g, "fxtwitter");
      }
      if (!/fxtwitter\.com/gim.test(vxMsg)) {
        return;
      }
      if (removeMentionPresent[msg.guildId] && (msg.mentions.everyone || /@everyone|@here/gi.test(msg.content) || msg.mentions.users.size > 0 || msg.mentions.roles.size > 0)) {
        let removeFile = {};
        try {
          removeFile = JSON.parse(pako.inflate(fs.readFileSync("remove-lists.txt"), { to: "string" }));
        } catch (err) {
          console.log("Error in replacing link file read  ", err.code);
        }
        let tempRemoveObject = removeFile[msg.guildId];

        allowedMentionsObject = MentionAllower(tempRemoveObject, msg.mentions, msg.content);
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
                username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id)&&client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).hasOwnProperty("displayName") ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName : msg.author.username,
                avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id)?client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id)?client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL():msg.author.displayAvatarURL():msg.author.displayAvatarURL(),
                threadId: msg.channelId,
                files: msgAttachments,
                allowedMentions: allowedMentionsObject,
              });
              if(messageControlList[msg.guildId].deleteOriginal) msg.delete();
            } else if (webhookNumber === 1) {
              msg.guild.channels
                .createWebhook({ channel: msg.channel.parentId, name: "VxT 2" })
                .then((webhook) => {
                  webhook.send({
                    content: vxMsg,
                    username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id)&&client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).hasOwnProperty("displayName") ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName : msg.author.username,
                    avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id)?client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL():msg.author.displayAvatarURL(),
                    threadId: msg.channelId,
                    files: msgAttachments,
                    allowedMentions: allowedMentionsObject,
                  });
                  if(messageControlList[msg.guildId].deleteOriginal) msg.delete();
                })
                .catch(console.error);
            } else if (webhookNumber === 0) {
              msg.guild.channels
                .createWebhook({ channel: msg.channel.parentId, name: "VxT 1" })
                .then((webhook) => {
                  webhook.send({
                    content: vxMsg,
                    username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id)&&client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).hasOwnProperty("displayName") ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName : msg.author.username,
                    avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id)?client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL():msg.author.displayAvatarURL(),
                    threadId: msg.channelId,
                    files: msgAttachments,
                    allowedMentions: allowedMentionsObject,
                  });
                  if(messageControlList[msg.guildId].deleteOriginal) msg.delete();
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
            username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id)&&client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).hasOwnProperty("displayName") ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName : msg.author.username,
            avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id)?client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL():msg.author.displayAvatarURL(),
            files: msgAttachments,
            allowedMentions: allowedMentionsObject,
          });
          if(messageControlList[msg.guildId].deleteOriginal) msg.delete();
        } else if (webhookNumber === 1) {
          msg.channel
            .createWebhook({ name: "VxT 2" })
            .then((webhook) => {
              webhook.send({
                content: vxMsg,
                username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id)&&client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).hasOwnProperty("displayName") ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName : msg.author.username,
                avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id)?client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL():msg.author.displayAvatarURL(),
                files: msgAttachments,
                allowedMentions: allowedMentionsObject,
              });
              if(messageControlList[msg.guildId].deleteOriginal) msg.delete();
            })
            .catch(console.error);
        } else if (webhookNumber === 0) {
          msg.channel
            .createWebhook({ name: "VxT 1" })
            .then((webhook) => {
              webhook.send({
                content: vxMsg,
                username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id)&&client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).hasOwnProperty("displayName") ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName : msg.author.username,
                avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id)?client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL():msg.author.displayAvatarURL(),
                files: msgAttachments,
                allowedMentions: allowedMentionsObject,
              });
              if(messageControlList[msg.guildId].deleteOriginal) msg.delete();
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

  if (interaction.commandName === "toggle") {
    let type = interaction.options.getString("type");
    let interactionGuildID = interaction.guildId;
    if (type === "all") {
      let toggleFile = {};
      try {
        toggleFile = JSON.parse(pako.inflate(fs.readFileSync("toggle-list.txt"), { to: "string" }));
      } catch (err) {
        console.log("Error in all read file sync toggle", err.code);
      }
      let toggleObj = toggleFile[interactionGuildID];

      if (toggleObj) {
        if (Object.values(toggleObj).some((val) => val === true)) {
          Object.keys(toggleObj).forEach((key) => {
            toggleObj[key] = false;
          });
        } else {
          Object.keys(toggleObj).forEach((key) => {
            toggleObj[key] = true;
          });
        }
      } else {
        toggleObj = { text: false, photos: false, videos: false, polls: false };
      }

      toggleFile[interactionGuildID] = toggleObj;
      fs.writeFile("toggle-list.txt", pako.deflate(JSON.stringify(toggleFile)), { encoding: "utf8" }, async (err) => {
        if (err) {
          console.log("error in file writing in all toggle   ", err.code);
        } else {
          await interaction.reply({ content: `Toggled all conversions ${Object.values(toggleObj).some((val) => val === true) ? `on` : `off`}` });
          return;
        }
      });
    } else if (type === "text") {
      let toggleFile = {};
      try {
        toggleFile = JSON.parse(pako.inflate(fs.readFileSync("toggle-list.txt"), { to: "string" }));
      } catch (err) {
        console.log("Error in text read file sync toggle", err.code);
      }
      let toggleObj = toggleFile[interactionGuildID];

      if (toggleObj) {
        toggleObj.text ? (toggleObj.text = false) : (toggleObj.text = true);
      } else {
        toggleObj = { text: false, photos: true, videos: true, polls: true };
      }

      toggleFile[interactionGuildID] = toggleObj;
      fs.writeFile("toggle-list.txt", pako.deflate(JSON.stringify(toggleFile)), { encoding: "utf8" }, async (err) => {
        if (err) {
          console.log("error in file writing in text toggle   ", err.code);
        } else {
          await interaction.reply({ content: `Toggled all text conversions ${toggleObj.text ? `on` : `off`}` });
          return;
        }
      });
    } else if (type === "photos") {
      let toggleFile = {};
      try {
        toggleFile = JSON.parse(pako.inflate(fs.readFileSync("toggle-list.txt"), { to: "string" }));
      } catch (err) {
        console.log("Error in photos read file sync toggle", err.code);
      }
      let toggleObj = toggleFile[interactionGuildID];

      if (toggleObj) {
        toggleObj.photos ? (toggleObj.photos = false) : (toggleObj.photos = true);
      } else {
        toggleObj = { text: true, photos: false, videos: true, polls: true };
      }

      toggleFile[interactionGuildID] = toggleObj;
      fs.writeFile("toggle-list.txt", pako.deflate(JSON.stringify(toggleFile)), { encoding: "utf8" }, async (err) => {
        if (err) {
          console.log("error in file writing in photos toggle   ", err.code);
        } else {
          await interaction.reply({ content: `Toggled all photo conversions ${toggleObj.photos ? `on` : `off`}` });
          return;
        }
      });
    } else if (type === "videos") {
      let toggleFile = {};
      try {
        toggleFile = JSON.parse(pako.inflate(fs.readFileSync("toggle-list.txt"), { to: "string" }));
      } catch (err) {
        console.log("Error in videos read file sync toggle", err.code);
      }
      let toggleObj = toggleFile[interactionGuildID];

      if (toggleObj) {
        toggleObj.videos ? (toggleObj.videos = false) : (toggleObj.videos = true);
      } else {
        toggleObj = { text: true, photos: true, videos: false, polls: true };
      }

      toggleFile[interactionGuildID] = toggleObj;
      fs.writeFile("toggle-list.txt", pako.deflate(JSON.stringify(toggleFile)), { encoding: "utf8" }, async (err) => {
        if (err) {
          console.log("error in file writing in videos toggle   ", err.code);
        } else {
          await interaction.reply({ content: `Toggled all video conversions ${toggleObj.videos ? `on` : `off`}` });
          return;
        }
      });
    } else if (type === "polls") {
      let toggleFile = {};
      try {
        toggleFile = JSON.parse(pako.inflate(fs.readFileSync("toggle-list.txt"), { to: "string" }));
      } catch (err) {
        console.log("Error in polls read file sync toggle", err.code);
      }
      let toggleObj = toggleFile[interactionGuildID];

      if (toggleObj) {
        toggleObj.polls ? (toggleObj.polls = false) : (toggleObj.polls = true);
      } else {
        toggleObj = { text: true, photos: true, videos: true, polls: false };
      }

      toggleFile[interactionGuildID] = toggleObj;
      fs.writeFile("toggle-list.txt", pako.deflate(JSON.stringify(toggleFile)), { encoding: "utf8" }, async (err) => {
        if (err) {
          console.log("error in file writing in polls toggle   ", err.code);
        } else {
          await interaction.reply({ content: `Toggled all poll conversions ${toggleObj.polls ? `on` : `off`}` });
          return;
        }
      });
    }
  }
  const filter1 = (tempMessage) => tempMessage.author.id === interaction.user.id;
  const collector1 = interaction.channel.createMessageCollector(filter1, { max: 1, time: 15000 });
  collector1.once("collect", async (message) => {
    messageControlList[message.guildId] = CheckMessageControls(message.guildId);
  });
  if (interaction.commandName === "message" && interaction.options.getSubcommand() === "deleteoriginal") {
    let messageControlFile = {};
    let interactionGuildID = interaction.guildId;
    try {
      messageControlFile = JSON.parse(pako.inflate(fs.readFileSync("message-control-list.txt"), { to: "string" }));
    } catch (err) {
      console.log("Error in message control list read delete original", err.code);
    }
    if (messageControlFile.hasOwnProperty(interactionGuildID)) {
      messageControlFile[interactionGuildID].deleteOriginal = !messageControlFile[interactionGuildID].deleteOriginal;
    } else {
      messageControlFile[interactionGuildID] = { deleteOriginal: true, otherWebhooks: false };
    }
    fs.writeFile("message-control-list.txt", pako.deflate(JSON.stringify(messageControlFile)), { encoding: "utf8" }, async (err) => {
      if (err) {
        console.log("error in file writing in message control list delete original    ", err.code);
      } else {
        await interaction.reply({ content: `Toggled delete original message ${messageControlFile[interactionGuildID].deleteOriginal ? "on" : "off"}.` });
        return;
      }
    });
  }
  if (interaction.commandName === "message" && interaction.options.getSubcommand() === "otherwebhooks") {
    let messageControlFile = {};
    let interactionGuildID = interaction.guildId;
    try {
      messageControlFile = JSON.parse(pako.inflate(fs.readFileSync("message-control-list.txt"), { to: "string" }));
    } catch (err) {
      console.log("Error in message control list read other webhooks", err.code);
    }
    if (messageControlFile.hasOwnProperty(interactionGuildID)) {
      messageControlFile[interactionGuildID].otherWebhooks = !messageControlFile[interactionGuildID].otherWebhooks;
    } else {
      messageControlFile[interactionGuildID] = { deleteOriginal: true, otherWebhooks: false };
    }
    fs.writeFile("message-control-list.txt", pako.deflate(JSON.stringify(messageControlFile)), { encoding: "utf8" }, async (err) => {
      if (err) {
        console.log("error in file writing in message control list other webhooks  ", err.code);
      } else {
        await interaction.reply({ content: `Toggled the operation on other webhooks ${messageControlFile[interactionGuildID].otherWebhooks ? "on" : "off"}.` });
        return;
      }
    });
  }

  const filter2 = (tempMessage) => tempMessage.author.id === interaction.user.id;
  const collector2 = interaction.channel.createMessageCollector(filter2, { max: 1, time: 15000 });
  collector2.once("collect", async (message) => {
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
  InitToggleList();
  InitMessageControlList();
  setTimeout(() => {
    client.guilds.cache.forEach((guild) => {
      removeMentionPresent[guild.id] = CheckRemoveMentions(guild.id);
      messageControlList[guild.id] = CheckMessageControls(guild.id);
    });
  }, 100);
});
// client.on("debug", ( e ) => console.log(e));
client.login(Config["TOKEN"]);

function InitMessageControlList() {
  let messageControlFile = {};
  try {
    messageControlFile = JSON.parse(pako.inflate(fs.readFileSync("message-control-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in message control list read init", err.code);
  }
  client.guilds.cache.forEach((guild) => {
    if (!messageControlFile.hasOwnProperty(guild.id)) {
      messageControlFile[guild.id] = { deleteOriginal: true, otherWebhooks: false };
    }
  });
  fs.writeFile("message-control-list.txt", pako.deflate(JSON.stringify(messageControlFile)), { encoding: "utf8" }, async (err) => {
    if (err) {
      console.log("error in init message control list write", err.code);
    }
  });
}
function InitToggleList() {
  let toggleFile = {};
  try {
    toggleFile = JSON.parse(pako.inflate(fs.readFileSync("toggle-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in init file sync read", err.code);
  }
  client.guilds.cache.forEach((guild) => {
    if (!toggleFile[guild.id]) {
      toggleFile[guild.id] = { text: true, photos: true, videos: true, polls: true };
    }
  });
  fs.writeFile("toggle-list.txt", pako.deflate(JSON.stringify(toggleFile)), { encoding: "utf8" }, async (err) => {
    if (err) {
      console.log("error in init toggle list", err.code);
    }
  });
}

function MentionAllower(tRO, msgMentions, msgContent) {
  let aMO = { parse: ["everyone", "roles", "users"], roles: [], users: [] };
  for (let tempElem of tRO.all) {
    if (tempElem === "all") {
      aMO.parse = [];
      return aMO;
    } else if (tempElem === "roles") {
      aMO.parse.splice(aMO.parse.indexOf("roles"), 1);
    } else if (tempElem === "users") {
      aMO.parse.splice(aMO.parse.indexOf("users"), 1);
    }
  }
  if (tRO.mentions.length > 0 && aMO.parse.length > 0) {
    if ((msgMentions.everyone || /@everyone|@here/gi.test(msgContent)) && tRO.mentions.some((elem) => elem.type === "everyone")) {
      aMO.parse.splice(aMO.parse.indexOf("everyone"), 1);
    }
    if (msgMentions.roles.size > 0 && aMO.parse.includes("roles")) {
      aMO.parse.splice(aMO.parse.indexOf("roles"), 1);
      for (let tempRole of msgMentions.roles) {
        if (!tRO.mentions.some((elem) => elem.data === tempRole[0])) {
          aMO.roles.push(tempRole[0]);
        }
      }
    }
    if (msgMentions.users.size > 0 && aMO.parse.includes("users")) {
      aMO.parse.splice(aMO.parse.indexOf("users"), 1);
      for (let tempUser of msgMentions.users) {
        if (!tRO.mentions.some((elem) => elem.data === tempUser[0])) {
          aMO.users.push(tempUser[0]);
        }
      }
    }
  }
  return aMO;
}
function CheckMessageControls(GID) {
  let messageControlFile = {};
  try {
    messageControlFile = JSON.parse(pako.inflate(fs.readFileSync("message-control-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in check message control read", err.code);
  }
  return messageControlFile[GID] || false;
}

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
    const data = await rest.put(Routes.applicationCommands(Config["Client ID"]), { body: globalCommandsBody });
    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();
