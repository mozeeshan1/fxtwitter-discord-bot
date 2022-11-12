const Config = require("./config.json");

const { Client, GatewayIntentBits, SlashCommandBuilder,Events,REST,Routes } = require("discord.js");
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildIntegrations],
});
const rest = new REST({ version: "10" }).setToken(Config["TOKEN"]);
const pingCommand = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Replies with pong");




client.on("messageCreate", async (msg) => {
  
  try {
    if (msg.webhookId) return;
    // console.log(msg.channel.type)
    if (msg.content === "ping") {
      msg.reply("pong");
    }
    if (msg.content.match(/http(s)*:\/\/(www.)*(mobile.)*twitter.com/gi)) {
      let vxMsg = msg.content.replace(/mobile.twitter/g, "twitter").replace(/twitter/g, "fxtwitter");
      let msgAttachments = [];
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

function getRandomItem(set) {
  let items = Array.from(set);
  let filtereditems = items.filter((elem) => {
    return elem[1].name === "VxT 1" || elem[1].name === "VxT 2";
  });
  return filtereditems[Math.floor(Math.random() * filtereditems.length)];
}
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply({ content: "Pong!"});
  }
});
client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});
// client.on("debug", ( e ) => console.log(e));
client.login(Config["TOKEN"]);

//registering slash commands here
(async () => {
  try {
    const data = await rest.put(Routes.applicationCommands(Config["Client ID"]), { body: [pingCommand] });
    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();