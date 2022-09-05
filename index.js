
const Config= require("./config.json")

const { Client, GatewayIntentBits } = require("discord.js");
const client = new Client({
  'intents': [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildIntegrations
  ],
});




client.on('messageCreate', async (msg) => {
  if (msg.webhookId) return;
  if (msg.content === "ping") {
    msg.reply("pong");
  }
  if (msg.content.match(/https:\/\/twitter.com/ig)) {
    let vxMsg = msg.content.replace(/twitter/g, 'vxtwitter');
    msg.channel.fetchWebhooks().then((webhooks) => {
      let webhookNumber=0;
      webhooks.forEach(webhook => {
        if((webhook.name==="VxT 1")||(webhook.name==="VxT 2")){
          webhookNumber++;
        }
      });


      if (webhookNumber === 2) {
        let webhook= getRandomItem(webhooks)[1];
          webhook.send({
            content: vxMsg,
            username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName,
            avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL(),
          });
          msg.delete();
      }
      else if (webhookNumber === 1) {
        msg.channel.createWebhook({ name: 'VxT 2' }).then((webhook) => {
          webhook.send({
            content: vxMsg,
            username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName,
            avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL(),
          });
          msg.delete();
        }).catch(console.error)
      }
      else if (webhookNumber === 0) {
        msg.channel.createWebhook({ name: 'VxT 1' }).then((webhook) => {
          webhook.send({
            content: vxMsg,
            username: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayName,
            avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL(),
          });
          msg.delete();
        }).catch(console.error)
      }
      else {
        console.log("IN ELSE LOOP")
      }

    });
  }
});


function randomNumber(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItem(set) {
    let items = Array.from(set);
  let filtereditems=items.filter((elem)=>{
    return (elem[1].name==="VxT 1"||elem[1].name==="VxT 2");
  })
    return filtereditems[Math.floor(Math.random() * filtereditems.length)];
}

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`)
})


// client.on("debug", ( e ) => console.log(e));
client.login(Config["TOKEN"]);
