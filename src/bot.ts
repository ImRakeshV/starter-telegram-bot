import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import { chunk } from "lodash";
import express from "express";
import { applyTextEffect, Variant } from "./textEffects";

import type { Variant as TextEffectVariant } from "./textEffects";
import { Configuration, OpenAIApi } from "openai";

type LastMsg = {
  ctx: any;
  message: any;
};

// const maxMsgsIn5Mins = 3;
// const maxMsgsInHour = 10;
// let user = {};
const admins = [1215760049, 1324072016];
const groupLink = 'https://t.me/crxfitbay';
const navMessage = `Hi please join group ${groupLink} to get health and fitness related queries clarified`;
// let lastMsgs = [] as Array<LastMsg>;
const MaxMsgsToStore = 10;
const tagMe = `Please tag me @CrxianBot for all queries related to health and fitness.`;

// const verifySpam = (usr) => {
//     let isSpam = false;
//     if (usr && usr['count'] > maxMsgsIn5Mins) {
//         if (((new Date).getTime() - usr['time'] <= maxMsgsIn5Mins) ||
//             ((new Date).getTime() - usr['time'] <= maxMsgsInHour)) {
//             isSpam = true;
//         } else if ((new Date).getTime() - usr['time'] > maxMsgsInHour) {
//             usr['count'] = 1;
//             usr['time'] = (new Date).getTime();
//         }
//     }
//     return isSpam;
// }

const checkIsAdmin = (message: any) => {
    return admins.indexOf(message.from.id) !== -1;
}
// const request = require('request');

const configuration = new Configuration({
  apiKey: "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"//"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",
});
const openai = new OpenAIApi(configuration);

// Create a bot using the Telegram token
const bot = new Bot(
  process.env.TELEGRAM_TOKEN || "5848410581:AAEo8G7SQ269fEdZ5oMclC3-jf80tTTWhck"
);

// Handle the /yo command to greet the user
// Handle the /effect command to apply text effects using an inline keyboard
type Effect = { code: TextEffectVariant; label: string };
const allEffects: Effect[] = [
  {
    code: "w",
    label: "Monospace",
  },
  {
    code: "b",
    label: "Bold",
  },
  {
    code: "i",
    label: "Italic",
  },
  {
    code: "d",
    label: "Doublestruck",
  },
  {
    code: "o",
    label: "Circled",
  },
  {
    code: "q",
    label: "Squared",
  },
];

const effectCallbackCodeAccessor = (effectCode: TextEffectVariant) =>
  `effect-${effectCode}`;

const effectsKeyboardAccessor = (effectCodes: string[]) => {
  const effectsAccessor = (effectCodes: string[]) =>
    effectCodes.map((code) =>
      allEffects.find((effect) => effect.code === code)
    );
  const effects = effectsAccessor(effectCodes);

  const keyboard = new InlineKeyboard();
  const chunkedEffects = chunk(effects, 3);
  for (const effectsChunk of chunkedEffects) {
    for (const effect of effectsChunk) {
      effect &&
        keyboard.text(effect.label, effectCallbackCodeAccessor(effect.code));
    }
    keyboard.row();
  }

  return keyboard;
};

const textEffectResponseAccessor = (
  originalText: string,
  modifiedText?: string
) =>
  `Original: ${originalText}` +
  (modifiedText ? `\nModified: ${modifiedText}` : "");

const parseTextEffectResponse = (
  response: string
): {
  originalText: string;
  modifiedText?: string;
} => {
  const originalText = (response.match(/Original: (.*)/) as any)[1];
  const modifiedTextMatch = response.match(/Modified: (.*)/);

  let modifiedText;
  if (modifiedTextMatch) modifiedText = modifiedTextMatch[1];

  if (!modifiedTextMatch) return { originalText };
  else return { originalText, modifiedText };
};

bot.command("effect", (ctx) =>
  ctx.reply(textEffectResponseAccessor(ctx.match), {
    reply_markup: effectsKeyboardAccessor(
      allEffects.map((effect) => effect.code)
    ),
  })
);

// Handle inline queries
const queryRegEx = /effect (monospace|bold|italic) (.*)/;
bot.inlineQuery(queryRegEx, async (ctx) => {
  const fullQuery = ctx.inlineQuery.query;
  const fullQueryMatch = fullQuery.match(queryRegEx);
  if (!fullQueryMatch) return;

  const effectLabel = fullQueryMatch[1];
  const originalText = fullQueryMatch[2];

  const effectCode = allEffects.find(
    (effect) => effect.label.toLowerCase() === effectLabel.toLowerCase()
  )?.code;
  const modifiedText = applyTextEffect(originalText, effectCode as Variant);

  await ctx.answerInlineQuery(
    [
      {
        type: "article",
        id: "text-effect",
        title: "Text Effects",
        input_message_content: {
          message_text: `Original: ${originalText}
Modified: ${modifiedText}`,
          parse_mode: "HTML",
        },
        reply_markup: new InlineKeyboard().switchInline("Share", fullQuery),
        url: "http://t.me/EludaDevSmarterBot",
        description: "Create stylish Unicode text, all within Telegram.",
      },
    ],
    { cache_time: 30 * 24 * 3600 } // one month in seconds
  );
});

// Return empty result list for other queries.
bot.on("inline_query", (ctx) => ctx.answerInlineQuery([]));

// Handle text effects from the effect keyboard
for (const effect of allEffects) {
  const allEffectCodes = allEffects.map((effect) => effect.code);

  bot.callbackQuery(effectCallbackCodeAccessor(effect.code), async (ctx) => {
    const { originalText } = parseTextEffectResponse(ctx.msg?.text || "");
    const modifiedText = applyTextEffect(originalText, effect.code);

    await ctx.editMessageText(
      textEffectResponseAccessor(originalText, modifiedText),
      {
        reply_markup: effectsKeyboardAccessor(
          allEffectCodes.filter((code) => code !== effect.code)
        ),
      }
    );
  });
}

// Handle the /about command
const aboutUrlKeyboard = new InlineKeyboard().url(
  "Visit CRXFitbay",
  "https://www.facebook.com/crxfitbay/"
);

// Suggest commands in the menu
bot.api.setMyCommands([
  { command: "yo", description: "Be greeted by the bot" },
  {
    command: "effect",
    description: "Apply text effects on the text. (usage: /effect [text])",
  },
]);

// Handle all other messages and the /start command
const introductionMessage = `Hello! I'm a Telegram bot.
This is a free service from CRX Fitbay. 
Join group https://t.me/crxfitbay`;

const replyWithIntro = (ctx: any) =>
  ctx.reply(introductionMessage, {
    reply_markup: aboutUrlKeyboard,
    parse_mode: "HTML",
  });

const onMessage = (ctx: any, message: any, tagCrx: boolean) => {
  console.log("ctx", message.text);
  try {
    const username = message.from.username
      ? `@${message.from.username}: `
      : `${message.from.first_name}: `;
    const userID = message.from.id;
    const isAdmin = checkIsAdmin(message);
    const isGroup = message.chat.type !== "private";
    const msgText =
      (!isAdmin || isGroup
        ? "Respond only related to Food, Fitness and health. "
        : "") + message.text.toLowerCase();
    console.log("Username posted query: ", username, message.text);
    // if (!user[userID]) {
    //   user[userID] = {
    //     count: 0,
    //     time: new Date().getTime(),
    //   };
    // }
    // user[userID]["count"] += 1;
    const botName = "@crxianbot";
    let imMentioned = tagCrx ? true : false;
    if (message && message.entities) {
      for (let i = 0; i < message.entities.length; i++) {
        if (
          message.entities[i]["type"] === "mention" &&
          msgText.toLowerCase().indexOf(botName) != -1
        ) {
          imMentioned = true;
        }
      }
    }
    // if (verifySpam(user[userID]) && !isAdmin) {
    //   ctx.reply("Sorry, too many questions in short time. Try again later", {
    //     reply_to_message_id: message.message_id,
    //   });
    //   return;
    // }
    // if (isGroup && !tagCrx && !imMentioned) {
    //   if (lastMsgs.length >= MaxMsgsToStore) {
    //     lastMsgs = lastMsgs.shift();
    //   }
    //   lastMsgs.push({ ctx: ctx, message: message });
    // }
    if (imMentioned && (isGroup || isAdmin)) {
      openai
        .createCompletion({
          model: "text-davinci-003",
          prompt: msgText.replace(botName, ""),
          temperature: 0.1,
          max_tokens: isAdmin ? 1000 : 400,
        })
        .then((completion) => {
          if (completion.data.choices[0].text) {
            const replyText = `${completion.data.choices[0].text}.\n${
              tagCrx ? tagMe : ""
            }`;
            ctx.reply(replyText, {
              reply_to_message_id: message.message_id,
            });
          } else {
            ctx.reply(`Sorry something wrong on my end. Please try again.`, {
              reply_to_message_id: message.message_id,
            });
            console.log(
              "**** No text completion",
              msgText.replace(botName, ""),
              completion.data.choices
            );
          }
          console.log(username, msgText.replace(botName, ""), "Responded");
        });
    } else if (!isGroup && !isAdmin) {
      console.log("Text private", ctx.update);
      ctx.reply(navMessage);
    } else if (isAdmin && isGroup) {
    }
  } catch (e) {
    console.log("Error: ", e);
  }
};

bot.command("start", replyWithIntro);

// bot.command('rlyGrp', (ctx) => {
//   if (checkIsAdmin(ctx.message)) {
//       // ctx.telegram.sendMessage("@crxfitbay", `The information provided here is for general informational and educational purposes only. It is not intended to be a substitue for professional medical advice, diagnosis or treatment. Always seek advice of your physician or other qualified health care provider wit any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking because of something you have read online or here in this group`);
//       const msgFromLast = Number(ctx.message.text.split(' ')[1]) || 1;
//       const msgCtx = lastMsgs.reverse()[msgFromLast - 1];
//       if (lastMsgs.length > 0 && msgCtx) {
//           ctx.reply(`Replying to: ${msgCtx['message']['text']}`);
//           onMessage(msgCtx['ctx'], msgCtx['message'], true);
//       } else {
//           ctx.reply("Message queue empty or not found");
//       }
//   }
// });

bot.on("edited_message", (ctx: any) => {
  onMessage(ctx, ctx.update.edited_message, false);
  console.log("edited msg", ctx.update.edited_message);
});
bot.on("message", (ctx: any) => {
  onMessage(ctx, ctx.message, false);
});

// Start the server
if (process.env.NODE_ENV === "production") {
  // Use Webhooks for the production server
  const app = express();
  app.use(express.json());
  app.use(webhookCallback(bot, "express"));

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Bot listening on port ${PORT}`);
  });
} else {
  // Use Long Polling for development
  bot.start();
}
