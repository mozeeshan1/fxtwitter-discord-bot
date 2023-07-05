const Config = require("./config.json");
const fs = require("fs");
const pako = require("pako");

const { Client, GatewayIntentBits, SlashCommandBuilder, Events, REST, Routes, PermissionFlagsBits, roleMention, userMention, GuildTemplate } = require("discord.js");
const { log } = require("console");
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildIntegrations, GatewayIntentBits.GuildMessageReactions],
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
  .addSubcommand((subcommand) =>
    subcommand
      .setName("toggle")
      .setDescription("Toggle the addition of d. subdomain to converted twitter links. Off by default.")
      .addStringOption((option) => option.setName("type").setDescription("The types of tweets to be converted").setRequired(true).addChoices({ name: "photos", value: "photos" }, { name: "videos", value: "videos" }))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("multiplephotos")
      .setDescription("Change the options for tweets with multiple photos. Conversion on by default.")
      .addStringOption((option) => option.setName("option").setDescription("Select an option.").setRequired(true).addChoices({ name: "convert", value: "convert" }, { name: "replacewithmosaic", value: "replacewithmosaic" }))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("quotetweet")
      .setDescription("Change the options for quote tweet behaviour. Conversion off by default.")
      .addStringOption((option) => option.setName("option").setDescription("Select an option.").setRequired(true).addChoices({ name: "convert", value: "convert" }, { name: "preferquotetweet", value: "preferquotetweet" }))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("channel")
      .setDescription("Change the permissions for which channels to convert in. All channels by default.")
      .addStringOption((option) => option.setName("action").setDescription("The action to be performed").setRequired(true).addChoices({ name: "list", value: "list" }, { name: "allow", value: "add" }, { name: "prohibit", value: "remove" }, { name: "allowall", value: "all" }, { name: "prohibitall", value: "clear" }))
      .addChannelOption((channelOption) => channelOption.setName("channel").setDescription("Select a channel for add or remove options."))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const translateTweetCommand = new SlashCommandBuilder()
  .setName("translate")
  .setDescription("Change tweet translation options.")
  .addSubcommand((subcommand) => subcommand.setName("toggle").setDescription("Toggle the translation of tweets. Off by default."))
  .addSubcommand((subcommand) =>
    subcommand
      .setName("language")
      .setDescription("Change the language the tweets are translated to. English by default.")
      .addStringOption((option) => option.setName("language").setDescription("The language to convert to.").setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const ddInstaCommand = new SlashCommandBuilder().setName("convertinstagram").setDescription("Toggle conversion of Instagram links to ddinstagram.").setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const delBotMessageCommand = new SlashCommandBuilder()
  .setName("deletebotmessage")
  .setDescription("Change settings of deleting bot messages with reactions.")
  .addSubcommand((subcommand) => subcommand.setName("toggle").setDescription("Toggle the ability to delete bot messages with reactions. Off by default."))
  .addSubcommand((subcommand) =>
    subcommand
      .setName("number")
      .setDescription("Change the number of reactions required to delete bot messages. 1 by default.")
      .addIntegerOption((number) => number.setName("number").setDescription("The number of reactions required.").setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
  const twitterConversionCommand = new SlashCommandBuilder()
    .setName("twitterconversion")
    .setDescription("Change preference for vxtwitter or fxtwitter.")
    .addSubcommand((subcommand) => subcommand.setName("select").setDescription("Select between vxtwitter and fxtwttier. vxtwitter by default.").addStringOption((option)=> option.setName("preference").setDescription("The options for preference of twitter link conversion.").setRequired(true).addChoices({name:"fxtwitter",value:"fxtwitter"},{name:"vxtwitter",value:"vxtwitter"})))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const globalCommandsBody = [pingCommand, mentionRemoveCommand, fxToggleCommand, messageControlCommand, quoteTweetCommand, retweetCommand, directMediaCommand, translateTweetCommand, ddInstaCommand, delBotMessageCommand, twitterConversionCommand];

let tempMessage = null;
let removeMentionPresent = {};
let userList = {};
let roleList = {};
let messageControlList = {};
let globalToggleFile = {};
let globalQuoteTweetFile = {};
let globalRetweetFile = {};
let globalDMediaFile = {};
let globalTranslateFile = {};
let globalInstaConversionFile = {};
let globalDeleteBotMessageFile = {};
let globalTwitterConversionFile={};
let nativeISOLanguages = {
  Afaraf: "aa",
  аҧсшәа: "ab",
  Afrikaans: "af",
  Akan: "ak",
  አማርኛ: "am",
  العربية: "ar",
  aragonés: "an",
  অসমীয়া: "as",
  "авар мацӀ": "av",
  avesta: "ae",
  "aymar aru": "ay",
  "azərbaycan dili": "az",
  башҡорт: "ba",
  bamanankan: "bm",
  "беларуская мова": "be",
  বাংলা: "bn",
  Bislama: "bi",
  "བོད་ཡིག": "bo",
  "bosanski jezik": "bs",
  brezhoneg: "br",
  "български език": "bg",
  català: "ca",
  čeština: "cs",
  Chamoru: "ch",
  "нохчийн мотт": "ce",
  "ѩзыкъ словѣньскъ": "cu",
  "чӑваш чӗлхи": "cv",
  Kernewek: "kw",
  corsu: "co",
  ᓀᐦᐃᔭᐍᐏᐣ: "cr",
  Cymraeg: "cy",
  dansk: "da",
  Deutsch: "de",
  ދިވެހި: "dv",
  "རྫོང་ཁ": "dz",
  ελληνικά: "el",
  English: "en",
  Esperanto: "eo",
  eesti: "et",
  euskara: "eu",
  Eʋegbe: "ee",
  føroyskt: "fo",
  فارسی: "fa",
  "vosa Vakaviti": "fj",
  suomi: "fi",
  français: "fr",
  Frysk: "fy",
  Fulfulde: "ff",
  Gàidhlig: "gd",
  Gaeilge: "ga",
  galego: "gl",
  Gaelg: "gv",
  "Avañe'ẽ": "gn",
  ગુજરાતી: "gu",
  "Kreyòl ayisyen": "ht",
  هَوُسَ: "ha",
  undefined: "sh",
  עברית: "he",
  Otjiherero: "hz",
  हिन्दी: "hi",
  "Hiri Motu": "ho",
  "hrvatski jezik": "hr",
  magyar: "hu",
  Հայերեն: "hy",
  "Asụsụ Igbo": "ig",
  Ido: "io",
  "ꆈꌠ꒿ Nuosuhxop": "ii",
  ᐃᓄᒃᑎᑐᑦ: "iu",
  Interlingue: "ie",
  Interlingua: "ia",
  "Bahasa Indonesia": "id",
  Iñupiaq: "ik",
  Íslenska: "is",
  italiano: "it",
  "basa Jawa": "jv",
  日本語: "ja",
  kalaallisut: "kl",
  ಕನ್ನಡ: "kn",
  कश्मीरी: "ks",
  ქართული: "ka",
  Kanuri: "kr",
  "қазақ тілі": "kk",
  ខ្មែរ: "km",
  Gĩkũyũ: "ki",
  Ikinyarwanda: "rw",
  Кыргызча: "ky",
  "коми кыв": "kv",
  Kikongo: "kg",
  한국어: "ko",
  Kuanyama: "kj",
  Kurdî: "ku",
  ພາສາລາວ: "lo",
  latine: "la",
  "latviešu valoda": "lv",
  Limburgs: "li",
  Lingála: "ln",
  "lietuvių kalba": "lt",
  Lëtzebuergesch: "lb",
  Tshiluba: "lu",
  Luganda: "lg",
  "Kajin M̧ajeļ": "mh",
  മലയാളം: "ml",
  मराठी: "mr",
  "македонски јазик": "mk",
  "fiteny malagasy": "mg",
  Malti: "mt",
  "Монгол хэл": "mn",
  "te reo Māori": "mi",
  "bahasa Melayu": "ms",
  ဗမာစာ: "my",
  "Ekakairũ Naoero": "na",
  "Diné bizaad": "nv",
  "isi Ndebele": "nd",
  Owambo: "ng",
  नेपाली: "ne",
  Nederlands: "nl",
  "Norsk nynorsk": "nn",
  "Norsk bokmål": "nb",
  Norsk: "no",
  chiCheŵa: "ny",
  occitan: "oc",
  ᐊᓂᔑᓈᐯᒧᐎᓐ: "oj",
  ଓଡ଼ିଆ: "or",
  "Afaan Oromoo": "om",
  "ирон æвзаг": "os",
  ਪੰਜਾਬੀ: "pa",
  पाऴि: "pi",
  "język polski": "pl",
  português: "pt",
  پښتو: "ps",
  "Runa Simi": "qu",
  "rumantsch grischun": "rm",
  "limba română": "ro",
  Ikirundi: "rn",
  Русский: "ru",
  "yângâ tî sängö": "sg",
  संस्कृतम्: "sa",
  සිංහල: "si",
  slovenčina: "sk",
  slovenščina: "sl",
  Davvisámegiella: "se",
  "gagana fa'a Samoa": "sm",
  chiShona: "sn",
  सिन्धी: "sd",
  Soomaaliga: "so",
  Sesotho: "st",
  español: "es",
  Shqip: "sq",
  sardu: "sc",
  "српски језик": "sr",
  SiSwati: "ss",
  "Basa Sunda": "su",
  Kiswahili: "sw",
  svenska: "sv",
  "Reo Tahiti": "ty",
  தமிழ்: "ta",
  "татар теле": "tt",
  తెలుగు: "te",
  тоҷикӣ: "tg",
  "Wikang Tagalog": "tl",
  ไทย: "th",
  ትግርኛ: "ti",
  "faka Tonga": "to",
  Setswana: "tn",
  Xitsonga: "ts",
  Türkmen: "tk",
  Türkçe: "tr",
  Twi: "tw",
  ئۇيغۇرچە: "ug",
  "українська мова": "uk",
  اردو: "ur",
  Oʻzbek: "uz",
  Tshivenḓa: "ve",
  "Tiếng Việt": "vi",
  Volapük: "vo",
  walon: "wa",
  Wollof: "wo",
  isiXhosa: "xh",
  ייִדיש: "yi",
  Yorùbá: "yo",
  "Saɯ cueŋƅ": "za",
  中文: "zh",
  isiZulu: "zu",
};
let englishISOLanguages = {
  Afar: "aa",
  Abkhazian: "ab",
  Afrikaans: "af",
  Akan: "ak",
  Amharic: "am",
  Arabic: "ar",
  Aragonese: "an",
  Assamese: "as",
  Avaric: "av",
  Avestan: "ae",
  Aymara: "ay",
  Azerbaijani: "az",
  Bashkir: "ba",
  Bambara: "bm",
  Belarusian: "be",
  Bengali: "bn",
  Bislama: "bi",
  Tibetan: "bo",
  Bosnian: "bs",
  Breton: "br",
  Bulgarian: "bg",
  Catalan: "ca",
  Czech: "cs",
  Chamorro: "ch",
  Chechen: "ce",
  "Church Slavic": "cu",
  Chuvash: "cv",
  Cornish: "kw",
  Corsican: "co",
  Cree: "cr",
  Welsh: "cy",
  Danish: "da",
  German: "de",
  Dhivehi: "dv",
  Dzongkha: "dz",
  "Modern Greek (1453-)": "el",
  English: "en",
  Esperanto: "eo",
  Estonian: "et",
  Basque: "eu",
  Ewe: "ee",
  Faroese: "fo",
  Persian: "fa",
  Fijian: "fj",
  Finnish: "fi",
  French: "fr",
  "Western Frisian": "fy",
  Fulah: "ff",
  "Scottish Gaelic": "gd",
  Irish: "ga",
  Galician: "gl",
  Manx: "gv",
  Guarani: "gn",
  Gujarati: "gu",
  Haitian: "ht",
  Hausa: "ha",
  "Serbo-Croatian": "sh",
  Hebrew: "he",
  Herero: "hz",
  Hindi: "hi",
  "Hiri Motu": "ho",
  Croatian: "hr",
  Hungarian: "hu",
  Armenian: "hy",
  Igbo: "ig",
  Ido: "io",
  "Sichuan Yi": "ii",
  Inuktitut: "iu",
  Interlingue: "ie",
  "Interlingua (International Auxiliary Language Association)": "ia",
  Indonesian: "id",
  Inupiaq: "ik",
  Icelandic: "is",
  Italian: "it",
  Javanese: "jv",
  Japanese: "ja",
  Kalaallisut: "kl",
  Kannada: "kn",
  Kashmiri: "ks",
  Georgian: "ka",
  Kanuri: "kr",
  Kazakh: "kk",
  "Central Khmer": "km",
  Kikuyu: "ki",
  Kinyarwanda: "rw",
  Kirghiz: "ky",
  Komi: "kv",
  Kongo: "kg",
  Korean: "ko",
  Kuanyama: "kj",
  Kurdish: "ku",
  Lao: "lo",
  Latin: "la",
  Latvian: "lv",
  Limburgan: "li",
  Lingala: "ln",
  Lithuanian: "lt",
  Luxembourgish: "lb",
  "Luba-Katanga": "lu",
  Ganda: "lg",
  Marshallese: "mh",
  Malayalam: "ml",
  Marathi: "mr",
  Macedonian: "mk",
  Malagasy: "mg",
  Maltese: "mt",
  Mongolian: "mn",
  Maori: "mi",
  "Malay (macrolanguage)": "ms",
  Burmese: "my",
  Nauru: "na",
  Navajo: "nv",
  "South Ndebele": "nr",
  "North Ndebele": "nd",
  Ndonga: "ng",
  "Nepali (macrolanguage)": "ne",
  Dutch: "nl",
  "Norwegian Nynorsk": "nn",
  "Norwegian Bokmål": "nb",
  Norwegian: "no",
  Nyanja: "ny",
  "Occitan (post 1500)": "oc",
  Ojibwa: "oj",
  "Oriya (macrolanguage)": "or",
  Oromo: "om",
  Ossetian: "os",
  Panjabi: "pa",
  Pali: "pi",
  Polish: "pl",
  Portuguese: "pt",
  Pushto: "ps",
  Quechua: "qu",
  Romansh: "rm",
  Romanian: "ro",
  Rundi: "rn",
  Russian: "ru",
  Sango: "sg",
  Sanskrit: "sa",
  Sinhala: "si",
  Slovak: "sk",
  Slovenian: "sl",
  "Northern Sami": "se",
  Samoan: "sm",
  Shona: "sn",
  Sindhi: "sd",
  Somali: "so",
  "Southern Sotho": "st",
  Spanish: "es",
  Albanian: "sq",
  Sardinian: "sc",
  Serbian: "sr",
  Swati: "ss",
  Sundanese: "su",
  "Swahili (macrolanguage)": "sw",
  Swedish: "sv",
  Tahitian: "ty",
  Tamil: "ta",
  Tatar: "tt",
  Telugu: "te",
  Tajik: "tg",
  Tagalog: "tl",
  Thai: "th",
  Tigrinya: "ti",
  "Tonga (Tonga Islands)": "to",
  Tswana: "tn",
  Tsonga: "ts",
  Turkmen: "tk",
  Turkish: "tr",
  Twi: "tw",
  Uighur: "ug",
  Ukrainian: "uk",
  Urdu: "ur",
  Uzbek: "uz",
  Venda: "ve",
  Vietnamese: "vi",
  Volapük: "vo",
  Walloon: "wa",
  Wolof: "wo",
  Xhosa: "xh",
  Yiddish: "yi",
  Yoruba: "yo",
  Zhuang: "za",
  Chinese: "zh",
  Zulu: "zu",
};
client.on("messageCreate", async (msg) => {
  try {
    if (messageControlList.hasOwnProperty(msg.guildId) && messageControlList[msg.guildId].hasOwnProperty("otherWebhooks") && msg.webhookId && msg.type !== 20 && (await msg.fetchWebhook()).owner.id === client.user.id) return;
    else if ((!messageControlList.hasOwnProperty(msg.guildId) || !messageControlList[msg.guildId].hasOwnProperty("otherWebhooks")) && msg.webhookId) return;
    tempMessage = msg;
    // if (msg.content === "ping") {
    //   msg.reply("pong");
    // }
    let vxMsg = msg.content.replaceAll(")", " ".concat(`)`));
    if (!msg.guild.members.me.permissions.any("ManageWebhooks")) {
      return;
    }
    if (typeof globalInstaConversionFile[msg.guildId] !== "undefined" && globalInstaConversionFile[msg.guildId].toggle && msg.content.match(/http(s)*:\/\/(www\.)*instagram.com/gim)) {
      let instagramLinks = msg.content.match(/(http(s)*:\/\/(www\.)?(mobile\.)?(instagram.com)\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/gim);
      for (let iLink of instagramLinks) {
        tempILink = iLink.replaceAll(/(?=\/\?)\/[^\/]*/gim, ``);
        vxMsg = vxMsg.replaceAll(iLink, tempILink);
      }
      vxMsg = vxMsg.replaceAll(`instagram.com`, `ddinstagram.com`);
    }
    if (msg.content.match(/https(s)*:\/\/(www\.)*(mobile\.)*twitter.com/gim) && !globalTwitterConversionFile[msg.guildId].fxtwitter) {
      vxMsg = vxMsg.replaceAll(/(twitter)/gim, "vxtwitter");
    }
    if (msg.content.match(/http(s)*:\/\/(www\.)*(mobile\.)*twitter.com/gim) && globalTwitterConversionFile[msg.guildId].fxtwitter) {
      let convertToDomain = "fxtwitter";

      let toggleObj = globalToggleFile[msg.guildId];
      let quoteTObj = globalQuoteTweetFile[msg.guildId];
      let qTLinkConversion = quoteTObj.linkConversion;
      let retweetObj = globalRetweetFile[msg.guildId];
      let dMediaObj = globalDMediaFile[msg.guildId];
      let translateObj = globalTranslateFile[msg.guildId];

      let tweetsData = {};
      if (Object.values(dMediaObj.toggle).every((val) => val === true) && ((typeof dMediaObj.channelList !== "undefined" && dMediaObj.channelList.includes("all")) || (typeof msg.channelId !== "undefined" && dMediaObj.channelList.includes(msg.channelId)) || (typeof msg.channel.parentId !== "undefined" && dMediaObj.channelList.includes(msg.channel.parentId)))) {
        convertToDomain = "d.fxtwitter";
      }
      if (qTLinkConversion.follow) {
        qTLinkConversion.text = toggleObj.text;
        qTLinkConversion.photos = toggleObj.photos;
        qTLinkConversion.videos = toggleObj.videos;
        qTLinkConversion.polls = toggleObj.polls;
      }
      if (retweetObj.deleteOriginalLink) {
        let twitterLinks = vxMsg.match(/(http(s)*:\/\/(www\.)?(mobile\.)?(twitter.com)\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/gim);

        for (let i of twitterLinks) {
          let j = i.substring(i.indexOf("/status/") + 8);
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
              let authorRegex = new RegExp(tempStringStart.trim());
              let authorTest = authorRegex.test(tweetsData[rLink].text.trim());
              let retweetText = tweetsData[rLink].text.substring(tempStringStart.length - 1, tweetsData[rLink].text.length - 1);
              retweetText.trim() === ":" ? (retweetText = "") : (retweetText = retweetText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
              let textRegex = new RegExp(`^(${retweetText.trim()})`);
              let textTest = textRegex.test(tweetsData[tLink].text.trim());
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
        let twitterLinks = vxMsg.match(/(http(s)*:\/\/(www\.)?(mobile\.)?(twitter.com)\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/gim) || [];

        for (let i of twitterLinks) {
          let j = i.substring(i.indexOf("/status/") + 8);
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
      if (Object.values(toggleObj).every((val) => val === false) && Object.values(dMediaObj.toggle).every((val) => val === false) && (qTLinkConversion.ignore || (!qTLinkConversion.text && !qTLinkConversion.photos && !qTLinkConversion.videos && !qTLinkConversion.polls))) {
        return;
      } else if (Object.values(toggleObj).every((val) => val === true) && Object.values(dMediaObj.toggle).every((val) => val === false) && (qTLinkConversion.ignore || qTLinkConversion.follow || (qTLinkConversion.text && qTLinkConversion.photos && qTLinkConversion.videos && qTLinkConversion.polls))) {
        let twitterLinks = vxMsg.match(/(http(s)*:\/\/(www\.)?(mobile\.)?(twitter.com)\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/gim);
        if (translateObj.toggle) {
          for (let tLink of twitterLinks) {
            let tempFXLink = `https://${convertToDomain}.com`.concat(tLink.match(/(\/status\/)\d*/gm)[0], `/`, translateObj.languageCode);
            vxMsg = vxMsg.replaceAll(tLink, tempFXLink);
          }
        } else {
          for (let tLink of twitterLinks) {
            let tempFXLink = `https://${convertToDomain}.com`.concat(tLink.match(/(\/status\/)\d*/gm)[0]);
            vxMsg = vxMsg.replaceAll(tLink, tempFXLink);
          }
        }
      } else {
        let twitterLinks = vxMsg.match(/(http(s)*:\/\/(www\.)?(mobile\.)?(twitter.com)\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/gim);
        let replaceTwitterLinks = [];
        if (Object.keys(tweetsData).length === 0) {
          for (let i of twitterLinks) {
            if (!tweetsData.hasOwnProperty(i)) {
              let j = i.substring(i.indexOf("/status/") + 8);
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
            if (typeof tweetsData[qLink].quote !== "undefined") {
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
            }
          });
        }
        if (typeof dMediaObj.channelList !== "undefined" && (dMediaObj.channelList.includes("all") || (typeof msg.channelId !== "undefined" && dMediaObj.channelList.includes(msg.channelId)) || (typeof msg.channel.parentId !== "undefined" && dMediaObj.channelList.includes(msg.channel.parentId)))) {
          if (Object.values(dMediaObj.toggle).some((val) => val === true) && dMediaObj.multiplePhotos.convert) {
            if (dMediaObj.toggle.photos && dMediaObj.multiplePhotos.replaceWithMosaic) {
              replaceTwitterLinks.forEach(async (rLink) => {
                if (tweetsData[rLink].hasOwnProperty("media") && tweetsData[rLink].media.hasOwnProperty("mosaic")) {
                  let mosaicLink = await tweetsData[rLink].media.mosaic.formats[Object.keys(tweetsData[rLink].media.mosaic.formats)[0]];
                  if (dMediaObj.quoteTweet.convert && dMediaObj.quoteTweet.preferQuoteTweet && tweetsData[rLink].hasOwnProperty("quote") && tweetsData[rLink].quote.hasOwnProperty("media") && tweetsData[rLink].quote.media.hasOwnProperty("mosaic")) {
                    mosaicLink = tweetsData[rLink].quote.media.mosaic.formats[Object.keys(tweetsData[rLink].quote.media.mosaic.formats)[0]];
                  }
                  vxMsg = vxMsg.replaceAll(rLink, mosaicLink);
                  replaceTwitterLinks.splice(replaceTwitterLinks.indexOf(rLink), 1);
                } else if ((!tweetsData[rLink].hasOwnProperty("media") || dMediaObj.quoteTweet.preferQuoteTweet) && dMediaObj.quoteTweet.convert && tweetsData[rLink].hasOwnProperty("quote") && tweetsData[rLink].quote.hasOwnProperty("media") && tweetsData[rLink].quote.media.hasOwnProperty("mosaic")) {
                  let mosaicLink = tweetsData[rLink].quote.media.mosaic.formats[Object.keys(tweetsData[rLink].quote.media.mosaic.formats)[0]];
                  vxMsg = vxMsg.replaceAll(rLink, mosaicLink);
                  replaceTwitterLinks.splice(replaceTwitterLinks.indexOf(rLink), 1);
                }
              });
            } else if (dMediaObj.toggle.photos && !dMediaObj.multiplePhotos.replaceWithMosaic) {
              replaceTwitterLinks.forEach((rLink) => {
                if (tweetsData[rLink].hasOwnProperty("media") && tweetsData[rLink].media.hasOwnProperty("mosaic")) {
                  replaceTwitterLinks.splice(replaceTwitterLinks.indexOf(rLink), 1);
                }
              });
            }
          }
          if (Object.values(dMediaObj.toggle).some((val) => val === true) && dMediaObj.quoteTweet.convert) {
            replaceTwitterLinks.forEach((rLink) => {
              if (
                (dMediaObj.toggle.photos && (!tweetsData[rLink].hasOwnProperty("media") || dMediaObj.quoteTweet.preferQuoteTweet) && tweetsData[rLink].hasOwnProperty("quote") && tweetsData[rLink].quote.hasOwnProperty("media") && tweetsData[rLink].quote.media.hasOwnProperty("photos")) ||
                (dMediaObj.toggle.videos && (!tweetsData[rLink].hasOwnProperty("media") || dMediaObj.quoteTweet.preferQuoteTweet) && tweetsData[rLink].hasOwnProperty("quote") && tweetsData[rLink].quote.hasOwnProperty("media") && tweetsData[rLink].quote.media.hasOwnProperty("videos"))
              ) {
                let tempFXLink = `https://d.fxtwitter.com/status/${tweetsData[rLink].quote.id}/${translateObj.toggle ? translateObj.languageCode : ``}`;
                vxMsg = vxMsg.replaceAll(rLink, tempFXLink);
                replaceTwitterLinks.splice(replaceTwitterLinks.indexOf(rLink), 1);
              } else if ((dMediaObj.toggle.photos && tweetsData[rLink].hasOwnProperty("media") && tweetsData[rLink].media.hasOwnProperty("photos")) || (dMediaObj.toggle.videos && tweetsData[rLink].hasOwnProperty("media") && tweetsData[rLink].media.hasOwnProperty("videos"))) {
                let tempFXLink = `https://d.fxtwitter.com`.concat(rLink.match(/(\/status\/)\d*/gm)[0], `/${translateObj.toggle ? translateObj.languageCode : ``}`);
                vxMsg = vxMsg.replaceAll(rLink, tempFXLink);
                replaceTwitterLinks.splice(replaceTwitterLinks.indexOf(rLink), 1);
              }
            });
          }
          if (Object.values(dMediaObj.toggle).some((val) => val === true)) {
            replaceTwitterLinks.forEach((rLink) => {
              if (dMediaObj.toggle.photos && tweetsData[rLink].hasOwnProperty("media") && tweetsData[rLink].media.hasOwnProperty("photos")) {
                let tempFXLink = `https://d.fxtwitter.com`.concat(rLink.match(/(\/status\/)\d*/gm)[0], `/${translateObj.toggle ? translateObj.languageCode : ``}`);
                if (dMediaObj.quoteTweet.convert && dMediaObj.quoteTweet.preferQuoteTweet && tweetsData[rLink].hasOwnProperty("quote") && tweetsData[rLink].quote.hasOwnProperty("media") && tweetsData[rLink].quote.media.hasOwnProperty("photos")) {
                  tempFXLink = `https://d.fxtwitter.com/status/${tweetsData[rLink].quote.id}/${translateObj.toggle ? translateObj.languageCode : ``}`;
                }
                vxMsg = vxMsg.replaceAll(rLink, tempFXLink);
                replaceTwitterLinks.splice(replaceTwitterLinks.indexOf(rLink), 1);
              } else if (dMediaObj.toggle.videos && tweetsData[rLink].hasOwnProperty("media") && tweetsData[rLink].media.hasOwnProperty("videos")) {
                let tempFXLink = `https://d.fxtwitter.com`.concat(rLink.match(/(\/status\/)\d*/gm)[0], `/${translateObj.toggle ? translateObj.languageCode : ``}`);
                if (dMediaObj.quoteTweet.convert && dMediaObj.quoteTweet.preferQuoteTweet && tweetsData[rLink].hasOwnProperty("quote") && tweetsData[rLink].quote.hasOwnProperty("media") && tweetsData[rLink].quote.media.hasOwnProperty("videos")) {
                  tempFXLink = `https://d.fxtwitter.com/status/${tweetsData[rLink].quote.id}/${translateObj.toggle ? translateObj.languageCode : ``}`;
                }
                vxMsg = vxMsg.replaceAll(rLink, tempFXLink);
                replaceTwitterLinks.splice(replaceTwitterLinks.indexOf(rLink), 1);
              }
            });
          }
        }
        for (let j of replaceTwitterLinks) {
          let tempFXLink = `https://${convertToDomain}.com`.concat(j.match(/(\/status\/)\d*/gm)[0], `/${translateObj.toggle ? translateObj.languageCode : ``}`);
          vxMsg = vxMsg.replaceAll(j, tempFXLink);
        }
      }
    }
    if (vxMsg !== msg.content.replaceAll(")", " ".concat(`)`))) {
      vxMsg = vxMsg.replaceAll(/(fxtwitter)+\1/gim, "fxtwitter");
      let msgAttachments = [];
      let allowedMentionsObject = { parse: [] };
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
              botWebhook
                .send({
                  content: vxMsg,
                  username: msg.member !== null && msg.member.nickname !== null ? msg.member.nickname : msg.author.username,
                  avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id) ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL() : msg.author.displayAvatarURL(),
                  threadId: msg.channelId,
                  files: msgAttachments,
                  allowedMentions: allowedMentionsObject,
                })
                .then((whMessage) => {
                  if (globalDeleteBotMessageFile[msg.guildId].toggle) {
                    DeleteMessageReact(whMessage);
                  }
                });
              if (messageControlList[msg.guildId].deleteOriginal) msg.delete();
            } else if (webhookNumber === 0) {
              msg.guild.channels
                .createWebhook({ channel: msg.channel.parentId, name: "VxT" })
                .then((webhook) => {
                  webhook
                    .send({
                      content: vxMsg,
                      username: msg.member !== null && msg.member.nickname !== null ? msg.member.nickname : msg.author.username,
                      avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id) ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL() : msg.author.displayAvatarURL(),
                      threadId: msg.channelId,
                      files: msgAttachments,
                      allowedMentions: allowedMentionsObject,
                    })
                    .then((whMessage) => {
                      if (globalDeleteBotMessageFile[msg.guildId].toggle) {
                        DeleteMessageReact(whMessage);
                      }
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
          botWebhook
            .send({
              content: vxMsg,
              username: msg.member !== null && msg.member.nickname !== null ? msg.member.nickname : msg.author.username,
              avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id) ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL() : msg.author.displayAvatarURL(),
              files: msgAttachments,
              allowedMentions: allowedMentionsObject,
            })
            .then((whMessage) => {
              if (globalDeleteBotMessageFile[msg.guildId].toggle) {
                DeleteMessageReact(whMessage);
              }
            });
          if (messageControlList[msg.guildId].deleteOriginal) msg.delete();
        } else if (webhookNumber === 0) {
          msg.channel
            .createWebhook({ name: "VxT" })
            .then((webhook) => {
              webhook
                .send({
                  content: vxMsg,
                  username: msg.member !== null && msg.member.nickname !== null ? msg.member.nickname : msg.author.username,
                  avatarURL: client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id) ? client.guilds.cache.get(msg.guildId).members.cache.get(msg.author.id).displayAvatarURL() : msg.author.displayAvatarURL(),
                  files: msgAttachments,
                  allowedMentions: allowedMentionsObject,
                })
                .then((whMessage) => {
                  if (globalDeleteBotMessageFile[msg.guildId].toggle) {
                    DeleteMessageReact(whMessage);
                  }
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
function DeleteMessageReact(botMessage, numb = 0) {
  botMessage.react("❌").then(() => {
    setTimeout(() => {
      // console.log("collector loop",numb);
      const reactionFilter = (reaction) => reaction.emoji.name === "❌";
      const reactionCollector = botMessage.createReactionCollector({ reactionFilter, max: 5000, dispose: true });
      reactionCollector.on("collect", (r) => {
        // console.log(`Collected ${r.count}`);
        if (r.count >= globalDeleteBotMessageFile[botMessage.guildId].rNumber + 1) {
          botMessage.delete();
        }
      });
      // reactionCollector.on("remove", (r) => console.log(`Collected ${r.count}`));
      // reactionCollector.on("end", (collected) => console.log(`Collected ${collected.size} items `, collected.get("❌").count));
    }, 500);
  });
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply({ content: "Pong!" });
    return;
  }
  if (interaction.commandName === "twitterconversion") {
    const filter = (tempMessage) => tempMessage.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector(filter, { max: 1, time: 15000 });
    collector.once("collect", async (message) => {
      UpdateTwitterConversionFile();
    });
    let twitterConversionFile = {};
    let preference = interaction.options.getString("preference");
    let interactionGuildID = interaction.guildId;
    try {
      twitterConversionFile = JSON.parse(pako.inflate(fs.readFileSync("twitter-conversion-list.txt"), { to: "string" }));
    } catch (err) {
      console.log("Error in all read file sync twitter conversion interaction", err.code);
    }
    if (twitterConversionFile.hasOwnProperty(interactionGuildID)) {
      if (interaction.options.getSubcommand() === "select") {
        if(preference==="fxtwitter"){
          twitterConversionFile[interactionGuildID].fxtwitter=true
        }
        else{
          twitterConversionFile[interactionGuildID].fxtwitter = true;
        }
      }
    } else {
      twitterConversionFile[interactionGuildID] = { fxtwitter: true};
    }
    fs.writeFile("twitter-conversion-list.txt", pako.deflate(JSON.stringify(twitterConversionFile)), { encoding: "utf8" }, async (err) => {
      if (err) {
        console.log("error in file writing in twitter conversion list interaction   ", err.code);
      } else {
        let tempContent = `Twitter links will be converted to ${twitterConversionFile[interactionGuildID].fxtwitter ? `fxtwitter` : `vxtwitter`}`;
        await interaction.reply({ content: tempContent });
        return;
      }
    });
  }
  if (interaction.commandName === "deletebotmessage") {
    const filter = (tempMessage) => tempMessage.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector(filter, { max: 1, time: 15000 });
    collector.once("collect", async (message) => {
      UpdateDeleteBotMessageFile();
    });
    let deleteBotMsgFile = {};
    let reactionNumber = interaction.options.getInteger("number");
    let interactionGuildID = interaction.guildId;
    try {
      deleteBotMsgFile = JSON.parse(pako.inflate(fs.readFileSync("delete-bot-message-list.txt"), { to: "string" }));
    } catch (err) {
      console.log("Error in all read file sync delete bot message interaction", err.code);
    }
    if (deleteBotMsgFile.hasOwnProperty(interactionGuildID)) {
      if (interaction.options.getSubcommand() === "toggle") {
        deleteBotMsgFile[interactionGuildID].toggle = !deleteBotMsgFile[interactionGuildID].toggle;
      } else if (interaction.options.getSubcommand() === "number") {
        deleteBotMsgFile[interactionGuildID].rNumber = reactionNumber;
      }
    } else {
      deleteBotMsgFile[interactionGuildID] = { toggle: false, rNumber: 1 };
    }
    fs.writeFile("delete-bot-message-list.txt", pako.deflate(JSON.stringify(deleteBotMsgFile)), { encoding: "utf8" }, async (err) => {
      if (err) {
        console.log("error in file writing in delete bot message list interaction   ", err.code);
      } else {
        let tempContent = `Toggled the ability to delete bot message through reactions ${deleteBotMsgFile[interactionGuildID].toggle ? `on` : `off`}`;
        if (interaction.options.getSubcommand() === "number") {
          tempContent = `Number of reactions required set to ${deleteBotMsgFile[interactionGuildID].rNumber}`;
        }
        await interaction.reply({ content: tempContent });
        return;
      }
    });
  }
  if (interaction.commandName === "convertinstagram") {
    const filter = (tempMessage) => tempMessage.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector(filter, { max: 1, time: 15000 });
    collector.once("collect", async (message) => {
      UpdateGlobalInstaConversionFile();
    });
    let instaConversionFile = {};
    let interactionGuildID = interaction.guildId;
    try {
      instaConversionFile = JSON.parse(pako.inflate(fs.readFileSync("instagram-conversion-list.txt"), { to: "string" }));
    } catch (err) {
      console.log("Error in all read file sync instagram conversion interaction", err.code);
    }
    if (instaConversionFile.hasOwnProperty(interactionGuildID)) {
      instaConversionFile[interactionGuildID].toggle = !instaConversionFile[interactionGuildID].toggle;
    } else {
      instaConversionFile[guild.id] = { toggle: true };
    }
    fs.writeFile("instagram-conversion-list.txt", pako.deflate(JSON.stringify(instaConversionFile)), { encoding: "utf8" }, async (err) => {
      if (err) {
        console.log("error in file writing in instagram conversion list interaction   ", err.code);
      } else {
        let tempContent = `Toggled instagram link conversion ${instaConversionFile[interactionGuildID].toggle ? `on` : `off`}`;
        await interaction.reply({ content: tempContent });
        return;
      }
    });
  }
  if (interaction.commandName === "translate") {
    const filter = (tempMessage) => tempMessage.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector(filter, { max: 1, time: 15000 });
    collector.once("collect", async (message) => {
      UpdateGlobalTranslateFile();
    });
    let translateFile = {};
    let language = interaction.options.getString("language");
    let interactionGuildID = interaction.guildId;
    let translateActivated = false;
    try {
      translateFile = JSON.parse(pako.inflate(fs.readFileSync("translate-list.txt"), { to: "string" }));
    } catch (err) {
      console.log("Error in all read file sync translate interaction", err.code);
    }
    if (translateFile.hasOwnProperty(interactionGuildID)) {
      if (interaction.options.getSubcommand() === "toggle") {
        translateFile[interactionGuildID].toggle = !translateFile[interactionGuildID].toggle;
      } else if (interaction.options.getSubcommand() === "language") {
        const languageRegex = new RegExp(`^${language}$`, "ig");
        let filteredEngNames = Object.keys(englishISOLanguages).filter((engName) => {
          return languageRegex.test(engName);
        });
        let filteredNatNames = Object.keys(nativeISOLanguages).filter((natName) => {
          return languageRegex.test(natName);
        });
        if (filteredEngNames.length > 0) {
          translateFile[interactionGuildID].languageCode = englishISOLanguages[filteredEngNames[0]];
        } else if (filteredNatNames.length > 0) {
          translateFile[interactionGuildID].languageCode = nativeISOLanguages[filteredNatNames[0]];
        } else {
          await interaction.reply({ content: `Language not recognized. Please refer to the ISO 639-1 standard for the list of supported languages.\nYou can check the languages in ISO 639-1 here:\nhttps://en.wikipedia.org/wiki/List_of_ISO_639-1_codes` });
          return;
        }
        if (!translateFile[interactionGuildID].toggle) {
          translateFile[interactionGuildID].toggle = true;
          translateActivated = true;
        }
      }
    } else {
      translateFile[interactionGuildID] = { toggle: false, languageCode: "en" };
    }
    fs.writeFile("translate-list.txt", pako.deflate(JSON.stringify(translateFile)), { encoding: "utf8" }, async (err) => {
      if (err) {
        console.log("error in file writing in translate list interaction   ", err.code);
      } else {
        let tempContent = `Toggled tweet translation ${translateFile[interactionGuildID].toggle ? `on` : `off`}`;
        if (interaction.options.getSubcommand() === "language") {
          tempContent = `Language set to ${
            Object.keys(englishISOLanguages).filter((engName) => {
              return englishISOLanguages[engName] === translateFile[interactionGuildID].languageCode;
            })[0]
          }${translateActivated ? ` and turned on translation.` : `.`}`;
        }
        await interaction.reply({ content: tempContent });
        return;
      }
    });
  }
  if (interaction.commandName === "directmedia") {
    const filter = (tempMessage) => tempMessage.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector(filter, { max: 1, time: 15000 });
    collector.once("collect", async (message) => {
      UpdateGlobalDMediaFile();
    });
    let dMediaFile = {};
    let option = interaction.options.getString("option");
    let type = interaction.options.getString("type");
    let interactionGuildID = interaction.guildId;
    let action = interaction.options.getString("action");
    let channel = interaction.options.getChannel("channel");
    try {
      dMediaFile = JSON.parse(pako.inflate(fs.readFileSync("direct-media-list.txt"), { to: "string" }));
    } catch (err) {
      console.log("Error in all read file sync direct media interaction", err.code);
    }
    if (dMediaFile.hasOwnProperty(interactionGuildID)) {
      if (interaction.options.getSubcommand() === "toggle") {
        if (type === "photos") {
          dMediaFile[interactionGuildID].toggle.photos = !dMediaFile[interactionGuildID].toggle.photos;
        } else if (type === "videos") {
          dMediaFile[interactionGuildID].toggle.videos = !dMediaFile[interactionGuildID].toggle.videos;
        }
      } else if (interaction.options.getSubcommand() === "multiplephotos") {
        if (option === "convert") {
          dMediaFile[interactionGuildID].multiplePhotos.convert = !dMediaFile[interactionGuildID].multiplePhotos.convert;
        } else if (option === "replacewithmosaic") {
          dMediaFile[interactionGuildID].multiplePhotos.replaceWithMosaic = !dMediaFile[interactionGuildID].multiplePhotos.replaceWithMosaic;
          if (dMediaFile[interactionGuildID].multiplePhotos.replaceWithMosaic) {
            dMediaFile[interactionGuildID].multiplePhotos.convert = true;
          }
        }
      } else if (interaction.options.getSubcommand() === "quotetweet") {
        if (option === "convert") {
          dMediaFile[interactionGuildID].quoteTweet.convert = !dMediaFile[interactionGuildID].quoteTweet.convert;
        } else if (option === "preferquotetweet") {
          dMediaFile[interactionGuildID].quoteTweet.preferQuoteTweet = !dMediaFile[interactionGuildID].quoteTweet.preferQuoteTweet;
          if (dMediaFile[interactionGuildID].quoteTweet.preferQuoteTweet) {
            dMediaFile[interactionGuildID].quoteTweet.convert = true;
          }
        }
      } else if (interaction.options.getSubcommand() === "channel") {
        if (!dMediaFile[interactionGuildID].hasOwnProperty("channelList")) {
          dMediaFile[interactionGuildID].channelList = ["all"];
        }
        if (action === "list") {
          let channelNames = [];
          await interaction.member.guild.channels.cache.each((gChannel) => {
            if (dMediaFile[interactionGuildID].channelList.includes(gChannel.id)) {
              channelNames.push("**" + gChannel.name + "**");
            }
          });
          let tempContent = `Direct media conversion is allowed in the following channels/categories:\n\n${channelNames.join(", ")}`;
          if (dMediaFile[interactionGuildID].channelList.includes("all")) {
            tempContent = `Direct media conversions are allowed in all channels and categories`;
          } else if (channelNames.length === 0) {
            tempContent = `Direct media conversion is not allowed in any channel or category.`;
          }
          await interaction.reply({ content: tempContent });
          return;
        } else if (action === "add") {
          if (channel === null) {
            await interaction.reply({ content: "Please specify a channel or category." });
            return;
          }
          if (dMediaFile[interactionGuildID].channelList.includes("all")) {
            await interaction.reply({ content: `Direct media conversions are already allowed in all channels and categories.` });
            return;
          } else if (dMediaFile[interactionGuildID].channelList.includes(channel.id)) {
            await interaction.reply({ content: `Direct media conversion in the ${channel.name} channel/category is already allowed.` });
            return;
          }
          dMediaFile[interactionGuildID].channelList.push(channel.id);
        } else if (action === "remove") {
          if (channel === null) {
            await interaction.reply({ content: "Please specify a channel or category." });
            return;
          }
          if (dMediaFile[interactionGuildID].channelList.length === 0) {
            await interaction.reply({ content: `Direct media conversions are already prohibited in all channels and categories.` });
            return;
          } else if (dMediaFile[interactionGuildID].channelList.includes("all")) {
            dMediaFile[interactionGuildID].channelList = [];
            for (let cID of channel.guild.channels.cache.keys()) {
              dMediaFile[interactionGuildID].channelList.push(cID);
            }
          } else if (!dMediaFile[interactionGuildID].channelList.includes(channel.id)) {
            await interaction.reply({ content: `Direct media conversion in the ${channel.name} channel/category is already prohibited.\n\nPlease note that the rules for channels take precedence over categories. So if a category is prohibited but a channel in the category is allowed, then direct media conversions will take place in the channel.` });
            return;
          }
          dMediaFile[interactionGuildID].channelList.splice(dMediaFile[interactionGuildID].channelList.indexOf(channel.id), 1);
        } else if (action === "all") {
          dMediaFile[interactionGuildID].channelList = ["all"];
        } else if (action === "clear") {
          dMediaFile[interactionGuildID].channelList = [];
        }
      }
    } else {
      dMediaFile[interactionGuildID] = { toggle: { photos: false, videos: false }, multiplePhotos: { convert: true, replaceWithMosaic: false }, quoteTweet: { convert: false, preferQuoteTweet: false }, channelList: ["all"] };
    }
    fs.writeFile("direct-media-list.txt", pako.deflate(JSON.stringify(dMediaFile)), { encoding: "utf8" }, async (err) => {
      if (err) {
        console.log("error in file writing in direct media interaction   ", err.code);
      } else {
        let tempContent = ``;
        if (interaction.options.getSubcommand() === "multiplephotos") {
          switch (option) {
            case "convert":
              tempContent = `Toggled link conversion for tweets containing multiple photos ${dMediaFile[interactionGuildID].multiplePhotos.convert ? `on` : `off`}.`;
              break;
            case "replacewithmosaic":
              tempContent = `Toggled mosaic conversion for tweets containing multiple photos ${dMediaFile[interactionGuildID].multiplePhotos.replaceWithMosaic ? `on` : `off`}.`;
              break;
            default:
              break;
          }
        } else if (interaction.options.getSubcommand() === "toggle") {
          switch (type) {
            case "photos":
              tempContent = `Toggled direct media conversion for tweets with photos ${dMediaFile[interactionGuildID].toggle.photos ? `on` : `off`}.`;
              break;
            case "videos":
              tempContent = `Toggled direct media conversion for tweets with videos ${dMediaFile[interactionGuildID].toggle.videos ? `on` : `off`}.`;
              break;
            default:
              break;
          }
        } else if (interaction.options.getSubcommand() === "quotetweet") {
          switch (option) {
            case "convert":
              tempContent = `Toggled link conversion for quote tweets ${dMediaFile[interactionGuildID].quoteTweet.convert ? `on` : `off`}.`;
              break;
            case "preferquotetweet":
              tempContent = `Toggled preference for quote tweets conversion ${dMediaFile[interactionGuildID].quoteTweet.preferQuoteTweet ? `on` : `off`}.`;
              break;
            default:
              break;
          }
        } else if (interaction.options.getSubcommand() === "channel") {
          switch (action) {
            case "add":
              tempContent = `Direct media conversions will be allowed in the ${channel.name} channel/category.`;
              break;
            case "remove":
              tempContent = `Direct media conversions will not be allowed in the ${channel.name} channel/category.\n\nPlease note that the rules for channels take precedence over categories. So if a category is prohibited but a channel in the category is allowed, then direct media conversions will take place in the channel.`;
              break;
            case "all":
              tempContent = `Direct media conversions will be allowed in all channels and categories.`;
              break;
            case "clear":
              tempContent = `Direct media conversions will not be allowed in any channel or category.`;
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
  client.user.setActivity(client.guilds.cache.size > 1 ? `Currently in ${client.guilds.cache.size} servers` : `Currently in ${client.guilds.cache.size} server`);
  InitToggleList();
  InitMessageControlList();
  InitQuoteTweetList();
  InitRetweetList();
  InitDirectMediaList();
  InitTranslateList();
  InitInstaConversionList();
  InitDeleteBotMessageList();
  InitTwitterConversionList();
  setTimeout(() => {
    client.guilds.cache.forEach((guild) => {
      removeMentionPresent[guild.id] = CheckRemoveMentions(guild.id);
      messageControlList[guild.id] = CheckMessageControls(guild.id);

      // setTimeout(() => {
      //   let msgTime=1
      //   guild.channels.cache.forEach(async (tempChannel) => {
      //     if (globalDeleteBotMessageFile[guild.id].toggle&&(tempChannel.isTextBased() || tempChannel.isThread())) {
      //       let botMessages = await FetchBotMessagesTo(tempChannel,{days:2});
      //       console.log(tempChannel.name,"IN ON READY BOT ",botMessages.length);
      //       botMessages.reverse()
      //       botMessages.forEach(bMsg=>{
      //         setTimeout(async()=>{
      //         DeleteMessageReact(bMsg, botMessages.indexOf(bMsg));
      //         console.log(tempChannel.name,"   ",botMessages.indexOf(bMsg));},1000*msgTime);msgTime++
      //       })
      //     }
      //   });
      // }, 1000);

      // if (guild.members.me.permissions.any("ManageWebhooks")) {
      //   guild.fetchWebhooks().then((gWebhooks) => {
      //     gWebhooks.forEach((gWebhook, wID) => {
      //       if (gWebhook.owner.id === client.user.id && gWebhook.name !== "VxT") {
      //         gWebhook.delete();
      //       }
      //     });
      //   });
      // }
    });

    UpdateGlobalToggleFile();
    UpdateGlobalQuoteTweetFile();
    UpdateGlobalRetweetFile();
    UpdateGlobalDMediaFile();
    UpdateGlobalTranslateFile();
    UpdateGlobalInstaConversionFile();
    UpdateDeleteBotMessageFile();
    UpdateTwitterConversionFile();
  }, 500);
});

// Fetches messages from the current time till a specified duration of time in the past.
async function FetchBotMessagesTo(textChannel, tillTime = { years: 0, months: 0, weeks: 0, days: 1, hours: 0, minutes: 0, seconds: 0 }, lastId = null, tillDate = null) {
  let pastDate = new Date();
  if (tillDate === null) {
    Object.keys(tillTime).forEach((tPeriod) => {
      switch (tPeriod) {
        case "years":
          if (tillTime[tPeriod] === 0) break;
          pastDate = new Date(pastDate.getFullYear() - tillTime[tPeriod], pastDate.getMonth(), pastDate.getDate(), pastDate.getHours(), pastDate.getMinutes(), pastDate.getSeconds());
          break;
        case "months":
          if (tillTime[tPeriod] === 0) break;
          pastDate = new Date(pastDate.getFullYear(), pastDate.getMonth() - tillTime[tPeriod], pastDate.getDate(), pastDate.getHours(), pastDate.getMinutes(), pastDate.getSeconds());
          break;
        case "weeks": {
          if (tillTime[tPeriod] === 0) break;
          pastDate = new Date(pastDate.getFullYear(), pastDate.getMonth(), pastDate.getDate() - tillTime[tPeriod] * 7, pastDate.getHours(), pastDate.getMinutes(), pastDate.getSeconds());
          break;
        }
        case "days": {
          if (tillTime[tPeriod] === 0) break;
          pastDate = new Date(pastDate.getFullYear(), pastDate.getMonth(), pastDate.getDate() - tillTime[tPeriod], pastDate.getHours(), pastDate.getMinutes(), pastDate.getSeconds());
          break;
        }
        case "hours":
          if (tillTime[tPeriod] === 0) break;
          pastDate = new Date(pastDate.getFullYear(), pastDate.getMonth(), pastDate.getDate(), pastDate.getHours() - tillTime[tPeriod], pastDate.getMinutes(), pastDate.getSeconds());
          break;
        case "minutes":
          if (tillTime[tPeriod] === 0) break;
          pastDate = new Date(pastDate.getFullYear(), pastDate.getMonth(), pastDate.getDate(), pastDate.getHours(), pastDate.getMinutes() - tillTime[tPeriod], pastDate.getSeconds());
          break;
        case "seconds":
          if (tillTime[tPeriod] === 0) break;
          pastDate = new Date(pastDate.getFullYear(), pastDate.getMonth(), pastDate.getDate(), pastDate.getHours(), pastDate.getMinutes(), pastDate.getSeconds() - tillTime[tPeriod]);
          break;
      }
    });
  } else {
    pastDate = tillDate;
  }
  if (!textChannel.guild.members.me.permissionsIn(textChannel).has("ViewChannel") || !textChannel.guild.members.me.permissions.any("ReadMessageHistory")) return [];
  let messages = lastId === null ? await textChannel.messages.fetch({ limit: 100 }) : await textChannel.messages.fetch({ limit: 100, before: lastId });
  if (messages.size === 0) return [];

  // Filters the messages to find messages by the bot and converts it into an array and sorts it from oldest to newest
  let filteredMessages = messages
    .filter((tempMsg) => tempMsg.applicationId === client.application.id && tempMsg.webhookId && tempMsg.createdTimestamp >= pastDate.valueOf())
    .map((e) => e)
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  if (filteredMessages.length === 0) return [];
  if (filteredMessages[0].createdTimestamp >= pastDate.valueOf()) {
    let recursiveMessages = await FetchBotMessagesTo(textChannel, tillTime, filteredMessages[0].id, pastDate);
    return recursiveMessages.concat(filteredMessages);
  } else {
    return filteredMessages;
  }
}

// client.on("debug", ( e ) => console.log(e));
client.login(Config["TOKEN"]);
function InitTwitterConversionList() {
  let twitterConversionFile = {};
  try {
    twitterConversionFile = JSON.parse(pako.inflate(fs.readFileSync("twitter-conversion-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in twitter conversion list read init", err.code);
  }
  client.guilds.cache.forEach((guild) => {
    if (!twitterConversionFile.hasOwnProperty(guild.id)) {
      twitterConversionFile[guild.id] = {fxtwitter:true };
    }
  });
  fs.writeFile("twitter-conversion-list.txt", pako.deflate(JSON.stringify(twitterConversionFile)), { encoding: "utf8" }, async (err) => {
    if (err) {
      console.log("error in init twitter conversion list write", err.code);
    }
  });
}
function InitDeleteBotMessageList() {
  let deleteBotMsgFile = {};
  try {
    deleteBotMsgFile = JSON.parse(pako.inflate(fs.readFileSync("delete-bot-message-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in delete bot message list read init", err.code);
  }
  client.guilds.cache.forEach((guild) => {
    if (!deleteBotMsgFile.hasOwnProperty(guild.id)) {
      deleteBotMsgFile[guild.id] = { toggle: false, rNumber: 1 };
    }
  });
  fs.writeFile("delete-bot-message-list.txt", pako.deflate(JSON.stringify(deleteBotMsgFile)), { encoding: "utf8" }, async (err) => {
    if (err) {
      console.log("error in init delete bot messsage list write", err.code);
    }
  });
}
function InitInstaConversionList() {
  let instaConversionFile = {};
  try {
    instaConversionFile = JSON.parse(pako.inflate(fs.readFileSync("instagram-conversion-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in instagram conversion list read init", err.code);
  }
  client.guilds.cache.forEach((guild) => {
    if (!instaConversionFile.hasOwnProperty(guild.id)) {
      instaConversionFile[guild.id] = { toggle: true };
    }
  });
  fs.writeFile("instagram-conversion-list.txt", pako.deflate(JSON.stringify(instaConversionFile)), { encoding: "utf8" }, async (err) => {
    if (err) {
      console.log("error in init instagram conversion list write", err.code);
    }
  });
}
function InitTranslateList() {
  let translateFile = {};
  try {
    translateFile = JSON.parse(pako.inflate(fs.readFileSync("translate-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in translate list read init", err.code);
  }
  client.guilds.cache.forEach((guild) => {
    if (!translateFile.hasOwnProperty(guild.id)) {
      translateFile[guild.id] = { toggle: false, languageCode: "en" };
    }
  });
  fs.writeFile("translate-list.txt", pako.deflate(JSON.stringify(translateFile)), { encoding: "utf8" }, async (err) => {
    if (err) {
      console.log("error in init translate list write", err.code);
    }
  });
}
function InitDirectMediaList() {
  let dMediaFile = {};
  try {
    dMediaFile = JSON.parse(pako.inflate(fs.readFileSync("direct-media-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in direct media list read init", err.code);
  }
  client.guilds.cache.forEach((guild) => {
    if (!dMediaFile.hasOwnProperty(guild.id)) {
      dMediaFile[guild.id] = { toggle: { photos: false, videos: false }, multiplePhotos: { convert: true, replaceWithMosaic: false }, quoteTweet: { convert: false, preferQuoteTweet: false }, channelList: ["all"] };
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
function UpdateGlobalTranslateFile() {
  let translateFile = {};
  try {
    translateFile = JSON.parse(pako.inflate(fs.readFileSync("translate-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in text read file sync msg translate list update function", err.code);
  }
  globalTranslateFile = translateFile;
}
function UpdateGlobalInstaConversionFile() {
  let instaConversionFile = {};
  try {
    instaConversionFile = JSON.parse(pako.inflate(fs.readFileSync("instagram-conversion-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in text read file sync msg instagram conversion list update function", err.code);
  }
  globalInstaConversionFile = instaConversionFile;
}
function UpdateDeleteBotMessageFile() {
  let deleteBotMsgFile = {};
  try {
    deleteBotMsgFile = JSON.parse(pako.inflate(fs.readFileSync("delete-bot-message-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in text read file sync msg delete bot message update function", err.code);
  }
  globalDeleteBotMessageFile = deleteBotMsgFile;
}
function UpdateTwitterConversionFile() {
  let twitterConversionFile = {};
  try {
    twitterConversionFile = JSON.parse(pako.inflate(fs.readFileSync("twitter-conversion-list.txt"), { to: "string" }));
  } catch (err) {
    console.log("Error in text read file sync msg twitter conversion update function", err.code);
  }
  globalTwitterConversionFile = twitterConversionFile;
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
