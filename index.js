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
  .setDescription("Convert links for tweets including the following data. On by default.")
  .addStringOption((option) => option.setName("type").setDescription("The types of tweets to be converted").setRequired(true).addChoices({ name: "text", value: "text" }, { name: "photos", value: "photos" }, { name: "videos", value: "videos" }, { name: "polls", value: "polls" }, { name: "all", value: "all" }))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const messageControlCommand = new SlashCommandBuilder()
  .setName("message")
  .setDescription("Control message behaviour.")
  .addSubcommand((subcommand) => subcommand.setName("deleteoriginal").setDescription("Toggle the deletion of the original message. On by default."))
  .addSubcommand((subcommand) => subcommand.setName("otherwebhooks").setDescription("Toggle operation on webhooks from other bots. Off by default."))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const quoteTweetCommand = new SlashCommandBuilder()
  .setName("quotetweet")
  .setDescription("Change quote tweet options.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("linkconversion")
      .setDescription("Convert links for retweets including the following data. Follow tweet options is on by default.")
      .addStringOption((option) => option.setName("type").setDescription("The types of tweets to be converted").setRequired(true).addChoices({ name: "text", value: "text" }, { name: "photos", value: "photos" }, { name: "videos", value: "videos" }, { name: "polls", value: "polls" }, { name: "all", value: "all" }, { name: "follow tweets", value: "follow" }, { name: "ignore", value: "ignore" }))
  )
  .addSubcommand((subcommand) => subcommand.setName("removequotedtweet").setDescription("Toggle the removal of quote tweet in the message if present. Off by default."))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const retweetCommand = new SlashCommandBuilder()
  .setName("retweet")
  .setDescription("Change retweet options.")
  .addSubcommand((subcommand) => subcommand.setName("removeoriginaltweet").setDescription("Toggle the removal of original tweet in the message if present. Off by default."))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const directMediaCommand = new SlashCommandBuilder()
  .setName("directmedia")
  .setDescription("Change direct media link options.")
  .addSubcommand((subcommand) => subcommand.setName("toggle").setDescription("Toggle the addition of d. subdomain to converted twitter links. Off by default."))
  .addSubcommand((subcommand) =>
    subcommand
      .setName("multiplephotos")
      .setDescription("Change the options for tweets with multiple photos. Conversion on by default.")
      .addStringOption((option) => option.setName("option").setDescription("Select an option.").setRequired(true).addChoices({ name: "convert", value: "convert" }, { name: "replacewithmosaic", value: "replacewithmosaic" }))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const globalCommandsBody = [pingCommand, mentionRemoveCommand, fxToggleCommand, messageControlCommand, quoteTweetCommand, retweetCommand, directMediaCommand];

// make message collector for interaction reply
let tempMessage = null;
let removeMentionPresent = {};
let userList = {};
let roleList = {};
let messageControlList = {};
let globalToggleFile = {};
let globalQuoteTweetFile = {};
let globalRetweetFile = {};
let globalDMediaFile = {};

client.on("messageCreate", async (msg) => {
  try {
    // console.log(client.user.id);
    // console.log(guildWebhooks.entries());
    if (messageControlList.hasOwnProperty(msg.guildId) && messageControlList[msg.guildId].hasOwnProperty("otherWebhooks") && msg.webhookId && msg.type !== 20 && (await msg.fetchWebhook()).owner.id === client.user.id) return;
    else if ((!messageControlList.hasOwnProperty(msg.guildId) || !messageControlList[msg.guildId].hasOwnProperty("otherWebhooks")) && msg.webhookId) return;
    tempMessage = msg;
    // if (msg.content === "ping") {
    //   msg.reply("pong");
    // }
    if (msg.content.match(/http(s)*:\/\/(www\.)*(mobile\.)*twitter.com/gi)) {
      if (!msg.guild.members.me.permissions.any("ManageWebhooks")) {
        return;
      }
      let vxMsg = msg.content;
      let msgAttachments = [];
      let allowedMentionsObject = { parse: [] };
      let convertToDomain = "fxtwitter";

      let toggleObj = globalToggleFile[msg.guildId];
      let quoteTObj = globalQuoteTweetFile[msg.guildId];
      let qTLinkConversion = quoteTObj.linkConversion;
      let retweetObj = globalRetweetFile[msg.guildId];
      let dMediaObj = globalDMediaFile[msg.guildId];

      let tweetsData = {};
      if (dMediaObj.toggle) {
        convertToDomain = "d.fxtwitter";
      }
      if (qTLinkConversion.follow) {
        qTLinkConversion.text = toggleObj.text;
        qTLinkConversion.photos = toggleObj.photos;
        qTLinkConversion.videos = toggleObj.videos;
        qTLinkConversion.polls = toggleObj.polls;
      }
      if (retweetObj.deleteOriginalLink) {
        let twitterLinks = msg.content.match(/(http(s)*:\/\/(www\.)?(mobile\.)?(twitter.com)\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/gim);

        for (let i of twitterLinks) {
          let j = i.substring(i.indexOf("status/") + 7);
          let fxAPIUrl = "https://api.fxtwitter.com/status/".concat(j);
          await fetch(fxAPIUrl)
            .then((response) => {
              return response.json();
            })
            .then((data) => {
              if (!tweetsData.hasOwnProperty(i)) {
                tweetsData[i] = data.tweet;
              }
            });
        }
        let retweetedTweets = Object.keys(tweetsData).filter((key) => /^RT @/gim.test(tweetsData[key].text));

        let tweetsToDelete = [];
        retweetedTweets.forEach((rLink) => {
          tweetsToDelete.push(
            ...Object.keys(tweetsData).filter((tLink) => {
              let tempStringStart = `^RT @${tweetsData[tLink].author.screen_name}: `;
              let authorRegex = new RegExp(tempStringStart);
              let authorTest = authorRegex.test(tweetsData[rLink].text);
              let retweetText = tweetsData[rLink].text.substring(tempStringStart.length - 1, tweetsData[rLink].text.length - 1);
              retweetText = retweetText.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
              let textRegex = new RegExp(`^(${retweetText})`);
              let textTest = textRegex.test(tweetsData[tLink].text);
              let retweetCountTest = tweetsData[rLink].retweets === tweetsData[tLink].retweets;
              return authorTest && textTest && retweetCountTest;
            })
          );
        });
        tweetsToDelete.forEach((dLink) => {
          vxMsg = vxMsg.replaceAll(dLink, "");
        });
      }
      if (quoteTObj.deleteQuotedLink) {
        let twitterLinks = msg.content.match(/(http(s)*:\/\/(www\.)?(mobile\.)?(twitter.com)\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/gim);

        for (let i of twitterLinks) {
          let j = i.substring(i.indexOf("status/") + 7);
          let fxAPIUrl = "https://api.fxtwitter.com/status/".concat(j);
          await fetch(fxAPIUrl)
            .then((response) => {
              return response.json();
            })
            .then((data) => {
              if (!tweetsData.hasOwnProperty(i)) {
                tweetsData[i] = data.tweet;
              }
            });
        }
        let quotedTweets = Object.keys(tweetsData).filter((key) => tweetsData[key].hasOwnProperty("quote"));

        let tweetsToDelete = [];
        quotedTweets.forEach((qLink) => {
          tweetsToDelete.push(...Object.keys(tweetsData).filter((tLink) => tweetsData[qLink].quote.id === tweetsData[tLink].id));
        });
        tweetsToDelete.forEach((dLink) => {
          vxMsg = vxMsg.replaceAll(dLink, "");
        });
      }
      if (!dMediaObj.toggle&&Object.values(toggleObj).every((val) => val === false) && (qTLinkConversion.ignore || (!qTLinkConversion.text && !qTLinkConversion.photos && !qTLinkConversion.videos && !qTLinkConversion.polls))) {
        return;
      } else if (!dMediaObj.toggle&&Object.values(toggleObj).every((val) => val === true) && (qTLinkConversion.ignore || qTLinkConversion.follow || (qTLinkConversion.text && qTLinkConversion.photos && qTLinkConversion.videos && qTLinkConversion.polls))) {
        vxMsg = vxMsg.replace(/mobile.twitter/g, "twitter").replace(/twitter/g, convertToDomain);
      } else {
        let twitterLinks = msg.content.match(/(http(s)*:\/\/(www\.)?(mobile\.)?(twitter.com)\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/gim);
        let replaceTwitterLinks = [];
        if (Object.keys(tweetsData).length === 0) {
          for (let i of twitterLinks) {
            if (!tweetsData.hasOwnProperty(i)) {
              let j = i.substring(i.indexOf("status/") + 7);
              let fxAPIUrl = "https://api.fxtwitter.com/status/".concat(j);
              await fetch(fxAPIUrl)
                .then((response) => {
                  return response.json();
                })
                .then((data) => {
                  tweetsData[i] = data.tweet;
                });
            }
          }
        }
        let quotedTweets = Object.keys(tweetsData).filter((key) => tweetsData[key].hasOwnProperty("quote"));

        if (Object.values(toggleObj).some((val) => val === false)) {
          Object.keys(tweetsData).forEach((tLink) => {
            if (tweetsData[tLink].hasOwnProperty("media")) {
              if (tweetsData[tLink].media.hasOwnProperty("photos") && toggleObj.photos) {
                replaceTwitterLinks.push(tLink);
              } else if (tweetsData[tLink].media.hasOwnProperty("videos") && toggleObj.videos) {
                replaceTwitterLinks.push(tLink);
              }
            } else if (tweetsData[tLink].hasOwnProperty("poll") && toggleObj.polls) {
              replaceTwitterLinks.push(tLink);
            } else if (!(tweetsData[tLink].hasOwnProperty("media") || tweetsData[tLink].hasOwnProperty("poll")) && toggleObj.text) {
              replaceTwitterLinks.push(tLink);
            }
          });
        } else {
          Object.keys(tweetsData).forEach((tLink) => {
            replaceTwitterLinks.push(tLink);
          });
        }
        if (!qTLinkConversion.ignore) {
          quotedTweets.forEach((qLink) => {
            if (tweetsData[qLink].quote.hasOwnProperty("media")) {
              if (tweetsData[qLink].quote.media.hasOwnProperty("photos") && qTLinkConversion.photos) {
                replaceTwitterLinks.push(qLink);
              } else if (tweetsData[qLink].quote.media.hasOwnProperty("videos") && qTLinkConversion.videos) {
                replaceTwitterLinks.push(qLink);
              } else if (tweetsData[qLink].quote.media.hasOwnProperty("photos") && !qTLinkConversion.photos && replaceTwitterLinks.includes(qLink)) {
                replaceTwitterLinks.splice(replaceTwitterLinks.indexOf(qLink), 1);
              } else if (tweetsData[qLink].quote.media.hasOwnProperty("videos") && !qTLinkConversion.videos && replaceTwitterLinks.includes(qLink)) {
                replaceTwitterLinks.splice(replaceTwitterLinks.indexOf(qLink), 1);
              }
            } else if (tweetsData[qLink].quote.hasOwnProperty("poll") && qTLinkConversion.polls) {
              replaceTwitterLinks.push(qLink);
            } else if (!(tweetsData[qLink].quote.hasOwnProperty("media") || tweetsData[qLink].quote.hasOwnProperty("poll")) && qTLinkConversion.text) {
              replaceTwitterLinks.push(qLink);
            } else if (tweetsData[qLink].quote.media.hasOwnProperty("poll") && !qTLinkConversion.polls && replaceTwitterLinks.includes(qLink)) {
              replaceTwitterLinks.splice(replaceTwitterLinks.indexOf(qLink), 1);
            } else if (!(tweetsData[qLink].quote.hasOwnProperty("media") || tweetsData[qLink].quote.hasOwnProperty("poll")) && !qTLinkConversion.text && replaceTwitterLinks.includes(qLink)) {
              replaceTwitterLinks.splice(replaceTwitterLinks.indexOf(qLink), 1);
            }
          });
        }

        if (dMediaObj.toggle && !dMediaObj.multiplePhotos.convert) {
          if (dMediaObj.multiplePhotos.replaceWithMosaic) {
            replaceTwitterLinks.forEach((rLink) => {
              if (tweetsData[rLink].hasOwnProperty("media") && tweetsData[rLink].media.hasOwnProperty("mosaic")) {
                let mosaicLink = tweetsData[rLink].media.mosaic.formats[Object.keys(tweetsData[rLink].media.mosaic.formats)[0]];
                vxMsg = vxMsg.replaceAll(rLink, mosaicLink);
                replaceTwitterLinks.splice(replaceTwitterLinks.indexOf(rLink), 1);
              }
            });
          }
          else{ replaceTwitterLinks.forEach((rLink) => {
            if (tweetsData[rLink].hasOwnProperty("media") && tweetsData[rLink].media.hasOwnProperty("mosaic")) {
              replaceTwitterLinks.splice(replaceTwitterLinks.indexOf(rLink), 1);
            }
          });}
        }

        for (let j of replaceTwitterLinks) {
          let tempFXLink = j.replace(/mobile.twitter/g, "twitter").replace(/twitter/g, convertToDomain);
          vxMsg = vxMsg.replaceAll(j, tempFXLink);
        }
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
            let botWebhook = null;
            webhooks.forEach((webhook) => {
              if (webhook.name === "VxT") {
                botWebhook = webhook;
                webhookNumber++;
              }
            });

            if (webhookNumber === 1) {
              botWebhook.send({
                content: vxMsg,
                username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id) && client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).hasOwnProperty("displayName") ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName : msg.author.username,
                avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id) ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL() : msg.author.displayAvatarURL(),
                threadId: msg.channelId,
                files: msgAttachments,
                allowedMentions: allowedMentionsObject,
              });
              if (messageControlList[msg.guildId].deleteOriginal) msg.delete();
            } else if (webhookNumber === 0) {
              msg.guild.channels
                .createWebhook({ channel: msg.channel.parentId, name: "VxT" })
                .then((webhook) => {
                  webhook.send({
                    content: vxMsg,
                    username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id) && client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).hasOwnProperty("displayName") ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName : msg.author.username,
                    avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id) ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL() : msg.author.displayAvatarURL(),
                    threadId: msg.channelId,
                    files: msgAttachments,
                    allowedMentions: allowedMentionsObject,
                  });
                  if (messageControlList[msg.guildId].deleteOriginal) msg.delete();
                })
                .catch(console.error);
            } else {
              console.log("IN ELSE LOOP");
            }
          });
        return;
      }
      msg.channel.fetchWebhooks().then((webhooks) => {
        let botWebhook = null;
        let webhookNumber = 0;
        webhooks.forEach((webhook) => {
          if (webhook.name === "VxT") {
            botWebhook = webhook;
            webhookNumber++;
          }
        });

        if (webhookNumber === 1) {
          botWebhook.send({
            content: vxMsg,
            username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id) && client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).hasOwnProperty("displayName") ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName : msg.author.username,
            avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id) ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL() : msg.author.displayAvatarURL(),
            files: msgAttachments,
            allowedMentions: allowedMentionsObject,
          });
          if (messageControlList[msg.guildId].deleteOriginal) msg.delete();
        } else if (webhookNumber === 0) {
          msg.channel
            .createWebhook({ name: "VxT" })
            .then((webhook) => {
              webhook.send({
                content: vxMsg,
                username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id) && client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).hasOwnProperty("displayName") ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName : msg.author.username,
                avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id) ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL() : msg.author.displayAvatarURL(),
                files: msgAttachments,
                allowedMentions: allowedMentionsObject,
              });
              if (messageControlList[msg.guildId].deleteOriginal) msg.delete();
            })
            .catch(console.error);
        } else {
          console.log("IN ELSE LOOP");
        }
      });
    }
  } catch (e) {
    console.log("ERROR OCCURRED ", e);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply({ content: "Pong!" });
    return;
  }
  if (interaction.commandName === "directmedia") {
    const filter = (tempMessage) => tempMessage.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector(filter, { max: 1, time: 15000 });
    collector.once("collect", async (message) => {
      UpdateGlobalDMediaFile();
    });
    let dMediaFile = {};
    let option = interaction.options.getString("option");
    let interactionGuildID = interaction.guildId;
    try {
      dMediaFile = JSON.parse(pako.inflate(fs.readFileSync("direct-media-list.txt"), { to: "string" }));
    } catch (err) {
      console.log("Error in all read file sync direct media interaction", err.code);
    }
    if (dMediaFile.hasOwnProperty(interactionGuildID)) {
      if (interaction.options.getSubcommand() === "toggle") {
        dMediaFile[interactionGuildID].toggle = !dMediaFile[interactionGuildID].toggle;
      } else if (interaction.options.getSubcommand() === "multiplephotos") {
        if (option === "convert") {
          dMediaFile[interactionGuildID].multiplePhotos.convert = !dMediaFile[interactionGuildID].multiplePhotos.convert;
          if (dMediaFile[interactionGuildID].multiplePhotos.convert) {
            dMediaFile[interactionGuildID].multiplePhotos.replaceWithMosaic = false;
          }
        } else if (option === "replacewithmosaic") {
          dMediaFile[interactionGuildID].multiplePhotos.replaceWithMosaic = !dMediaFile[interactionGuildID].multiplePhotos.replaceWithMosaic;
          if (dMediaFile[interactionGuildID].multiplePhotos.replaceWithMosaic) {
            dMediaFile[interactionGuildID].multiplePhotos.convert = false;
          }
        }
      }
    } else {
      dMediaFile[interactionGuildID] = { toggle: false, multiplePhotos: { convert: true, replaceWithMosaic: false } };
    }
    fs.writeFile("direct-media-list.txt", pako.deflate(JSON.stringify(dMediaFile)), { encoding: "utf8" }, async (err) => {
      if (err) {
        console.log("error in file writing in all direct media interaction   ", err.code);
      } else {
        let tempContent = `Toggled direct media conversion ${dMediaFile[interactionGuildID].toggle ? `on` : `off`}`;
        if (interaction.options.getSubcommand() === "multiplephotos") {
          switch (option) {
            case "convert":
              tempContent = `Toggled link conversion for tweets containing multiple photos ${dMediaFile[interactionGuildID].multiplePhotos.convert ? `on` : `off`}`;
              break;
            case "replacewithmosaic":
              tempContent = `Toggled mosaic conversion for tweets containing multiple photos ${dMediaFile[interactionGuildID].multiplePhotos.replaceWithMosaic ? `on` : `off`}`;
              break;
            default:
              break;
          }
        }
        await interaction.reply({ content: tempContent });
        return;
      }
    });
  }
  if (interaction.commandName === "retweet") {
    const filter = (tempMessage) => tempMessage.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector(filter, { max: 1, time: 15000 });
    collector.once("collect", async (message) => {
      UpdateGlobalRetweetFile();
    });
    let retweetFile = {};
    let interactionGuildID = interaction.guildId;
    try {
      retweetFile = JSON.parse(pako.inflate(fs.readFileSync("retweet-list.txt"), { to: "string" }));
    } catch (err) {
      console.log("Error in all read file sync retweet interaction", err.code);
    }
    if (retweetFile.hasOwnProperty(interactionGuildID)) {
      if (interaction.options.getSubcommand() === "removeoriginaltweet") {
        retweetFile[interactionGuildID].deleteOriginalLink = !retweetFile[interactionGuildID].deleteOriginalLink;
      }
    } else {
      retweetFile[interactionGuildID] = { deleteOriginalLink: false };
    }
    fs.writeFile("retweet-list.txt", pako.deflate(JSON.stringify(retweetFile)), { encoding: "utf8" }, async (err) => {
      if (err) {
        console.log("error in file writing in all retweet interaction   ", err.code);
      } else {
        let tempContent = `Toggled delete original tweet in message ${retweetFile[interactionGuildID].deleteOriginalLink ? `on` : `off`}`;
        await interaction.reply({ content: tempContent });
        return;
      }
    });
  }
  if (interaction.commandName === "quotetweet") {
    const filter = (tempMessage) => tempMessage.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector(filter, { max: 1, time: 15000 });
    collector.once("collect", async (message) => {
      UpdateGlobalQuoteTweetFile();
    });
    let quoteTFile = {};
    let type = interaction.options.getString("type");
    let interactionGuildID = interaction.guildId;
    try {
      quoteTFile = JSON.parse(pako.inflate(fs.readFileSync("quote-tweet-list.txt"), { to: "string" }));
    } catch (err) {
      console.log("Error in all read file sync quotetweet interaction", err.code);
    }
    if (quoteTFile.hasOwnProperty(interactionGuildID)) {
      if (interaction.options.getSubcommand() === "linkconversion") {
        let quoteTObj = quoteTFile[interactionGuildID].linkConversion;
        let toggleObj = globalToggleFile[interactionGuildID];
        if (type === "follow") {
          quoteTObj.text = toggleObj.text;
          quoteTObj.photos = toggleObj.photos;
          quoteTObj.videos = toggleObj.videos;
          quoteTObj.polls = toggleObj.polls;
          quoteTObj.follow = !quoteTObj.follow;
          quoteTObj.ignore = false;
        } else if (type === "ignore") {
          quoteTObj.ignore = !quoteTObj.ignore;
        } else {
          if (type === "all") {
            if (Object.values(quoteTObj).some((val) => val === true)) {
              Object.keys(quoteTObj).forEach((key) => {
                quoteTObj[key] = false;
              });
            } else {
              Object.keys(quoteTObj).forEach((key) => {
                quoteTObj[key] = true;
              });
            }
          } else if (type === "text") {
            quoteTObj.text = !quoteTObj.text;
          } else if (type === "photos") {
            quoteTObj.photos = !quoteTObj.photos;
          } else if (type === "videos") {
            quoteTObj.videos = !quoteTObj.videos;
          } else if (type === "polls") {
            quoteTObj.polls = !quoteTObj.polls;
          }
          quoteTObj.ignore = false;
          quoteTObj.follow = false;
        }
        quoteTFile[interactionGuildID].linkConversion = quoteTObj;
      } else if (interaction.options.getSubcommand() === "removequotedtweet") {
        quoteTFile[interactionGuildID].deleteQuotedLink = !quoteTFile[interactionGuildID].deleteQuotedLink;
      }
    } else {
      quoteTFile[interactionGuildID] = { linkConversion: { follow: true, ignore: false, text: true, photos: true, videos: true, polls: true }, deleteQuotedLink: false };
    }
    fs.writeFile("quote-tweet-list.txt", pako.deflate(JSON.stringify(quoteTFile)), { encoding: "utf8" }, async (err) => {
      if (err) {
        console.log("error in file writing in all quotetweet interaction   ", err.code);
      } else {
        let tempContent = `Toggled delete quoted tweet in message ${quoteTFile[interactionGuildID].deleteQuotedLink ? `on` : `off`}`;
        if (interaction.options.getSubcommand() === "linkconversion") {
          let quoteTObj = quoteTFile[interactionGuildID].linkConversion;
          switch (type) {
            case "follow":
              tempContent = `Toggled follow tweet settings ${quoteTObj.follow ? `on` : `off`}`;
              break;
            case "ignore":
              tempContent = `Toggled ignoring quotetweet conversions ${quoteTObj.ignore ? `on` : `off`}`;
              break;
            case "all":
              tempContent = `Toggled all conversions ${Object.values(quoteTObj).some((val) => val === true) ? `on` : `off`}`;
              break;
            case "text":
              tempContent = `Toggled all text conversions ${quoteTObj.text ? `on` : `off`}`;
              break;
            case "photos":
              tempContent = `Toggled all photos conversions ${quoteTObj.photos ? `on` : `off`}`;
              break;
            case "videos":
              tempContent = `Toggled all videos conversions ${quoteTObj.videos ? `on` : `off`}`;
              break;
            case "polls":
              tempContent = `Toggled all polls conversions ${quoteTObj.polls ? `on` : `off`}`;
              break;
            default:
          }
        }

        await interaction.reply({ content: tempContent });
        return;
      }
    });
  }
  if (interaction.commandName === "toggle") {
    const filter = (tempMessage) => tempMessage.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector(filter, { max: 1, time: 15000 });
    collector.once("collect", async (message) => {
      UpdateGlobalToggleFile();
    });
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
  if (interaction.commandName === "message") {
    const filter = (tempMessage) => tempMessage.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector(filter, { max: 1, time: 15000 });
    collector.once("collect", async (message) => {
      messageControlList[message.guildId] = CheckMessageControls(message.guildId);
    });
  }
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
  if (interaction.commandName === "mention") {
    const filter = (tempMessage) => tempMessage.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector(filter, { max: 1, time: 15000 });
    collector.once("collect", async (message) => {
      removeMentionPresent[message.guildId] = CheckRemoveMentions(message.guildId);
    });
  }

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
  InitQuoteTweetList();
  InitRetweetList();
  InitDirectMediaList();
  setTimeout(() => {
    client.guilds.cache.forEach((guild) => {
      removeMentionPresent[guild.id] = CheckRemoveMentions(guild.id);
      messageControlList[guild.id] = CheckMessageControls(guild.id);
      if (guild.members.me.permissions.any("ManageWebhooks")) {
        guild.fetchWebhooks().then((gWebhooks) => {
          gWebhooks.forEach((gWebhook, wID) => {
            if (gWebhook.owner.id === client.user.id && gWebhook.name !== "VxT") {
              gWebhook.delete();
            }
          });
        });
      }
    });

    UpdateGlobalToggleFile();
    UpdateGlobalQuoteTweetFile();
    UpdateGlobalRetweetFile();
    UpdateGlobalDMediaFile();
  }, 500);
});
// client.on("debug", ( e ) => console.log(e));
client.login(Config["TOKEN"]);

function InitDirectMediaList() {
  let dMediaFile = {};
  try {
    dMediaFile = JSON.parse(pako.inflate(fs.readFileSync("direct-media-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in direct media list read init", err.code);
  }
  client.guilds.cache.forEach((guild) => {
    if (!dMediaFile.hasOwnProperty(guild.id)) {
      dMediaFile[guild.id] = { toggle: false, multiplePhotos: { convert: true, replaceWithMosaic: false } };
    }
  });
  fs.writeFile("direct-media-list.txt", pako.deflate(JSON.stringify(dMediaFile)), { encoding: "utf8" }, async (err) => {
    if (err) {
      console.log("error in init direct media list write", err.code);
    }
  });
}
function InitRetweetList() {
  let retweetFile = {};
  try {
    retweetFile = JSON.parse(pako.inflate(fs.readFileSync("retweet-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in retweet list read init", err.code);
  }
  client.guilds.cache.forEach((guild) => {
    if (!retweetFile.hasOwnProperty(guild.id)) {
      retweetFile[guild.id] = { deleteOriginalLink: false };
    }
  });
  fs.writeFile("retweet-list.txt", pako.deflate(JSON.stringify(retweetFile)), { encoding: "utf8" }, async (err) => {
    if (err) {
      console.log("error in init retweet list write", err.code);
    }
  });
}
function InitQuoteTweetList() {
  let quoteTFile = {};
  try {
    quoteTFile = JSON.parse(pako.inflate(fs.readFileSync("quote-tweet-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in quotetweet list read init", err.code);
  }
  client.guilds.cache.forEach((guild) => {
    if (!quoteTFile.hasOwnProperty(guild.id)) {
      quoteTFile[guild.id] = { linkConversion: { follow: true, ignore: false, text: true, photos: true, videos: true, polls: true }, deleteQuotedLink: false };
    }
  });
  fs.writeFile("quote-tweet-list.txt", pako.deflate(JSON.stringify(quoteTFile)), { encoding: "utf8" }, async (err) => {
    if (err) {
      console.log("error in init quotetweet list write", err.code);
    }
  });
}
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
function UpdateGlobalToggleFile() {
  let toggleFile = {};
  try {
    toggleFile = JSON.parse(pako.inflate(fs.readFileSync("toggle-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in text read file sync msg toggle update function", err.code);
  }
  globalToggleFile = toggleFile;
}
function UpdateGlobalQuoteTweetFile() {
  let quoteTFile = {};
  try {
    quoteTFile = JSON.parse(pako.inflate(fs.readFileSync("quote-tweet-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in text read file sync msg quote tweet update function", err.code);
  }
  globalQuoteTweetFile = quoteTFile;
}
function UpdateGlobalRetweetFile() {
  let retweetFile = {};
  try {
    retweetFile = JSON.parse(pako.inflate(fs.readFileSync("retweet-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in text read file sync msg retweet update function", err.code);
  }
  globalRetweetFile = retweetFile;
}
function UpdateGlobalDMediaFile() {
  let dMediaFile = {};
  try {
    dMediaFile = JSON.parse(pako.inflate(fs.readFileSync("direct-media-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in text read file sync msg direct media update function", err.code);
  }
  globalDMediaFile = dMediaFile;
}

function getBotWebhook(set) {
  let items = Array.from(set);
  let filtereditems = items.filter((elem) => {
    return elem[1].name === "VxT";
  });
  return filtereditems[0];
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
