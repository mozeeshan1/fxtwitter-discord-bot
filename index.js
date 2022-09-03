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

  if (msg.content === "ping") {
    msg.reply("pong");
  }
  if (msg.content.match(/^https:\/\/twitter.com/igm)) {
    let vxMsg = msg.content.replace('twitter', 'vxtwitter');
    msg.channel.fetchWebhooks().then((webhooks) => {

      if (webhooks.size === 2) {
        let webhook= getRandomItem(webhooks)[1];
          webhook.send({
            content: vxMsg,
            username: msg.author.username,
            avatarURL: msg.author.avatarURL()
          })
          msg.delete();
      }
      else if (webhooks.size === 1) {
        msg.channel.createWebhook({ name: 'VxT 2' }).then((webhook) => {
          webhook.send({
            content: vxMsg,
            username: msg.author.username,
            avatarURL: msg.author.avatarURL()
          })
          msg.delete();
        }).catch(console.error)
      }
      else if (webhooks.size === 0) {
        msg.channel.createWebhook({ name: 'VxT 1' }).then((webhook) => {
          webhook.send({
            content: vxMsg,
            username: msg.author.username,
            avatarURL: msg.author.avatarURL()
          })
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
    return items[Math.floor(Math.random() * items.length)];
}

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`)
})



client.login(process.env.TOKEN)
//const mySecret = process.env['TOKEN'