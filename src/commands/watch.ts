import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getPrice, getCached } from '../lib/prices';
import { toFixedNice, upper, nowKST } from '../lib/util';

const MAX_MINUTES = 60;

export const data = new SlashCommandBuilder()
  .setName('watch')
  .setDescription('코인 실시간 감시(메시지를 주기적으로 갱신)')
  .addStringOption(o => o.setName('심볼').setDescription('예: BTC, ETH').setRequired(true))
  .addStringOption(o => o
    .setName('통화')
    .setDescription('USDT/KRW/USD (기본: USDT 실시간)')
    .addChoices(
      { name: 'USDT (바이낸스 실시간)', value: 'USDT' },
      { name: 'KRW (업비트 폴링)', value: 'KRW' },
      { name: 'USD (≈USDT)', value: 'USD' },
    ))
  .addIntegerOption(o => o.setName('분').setDescription(`감시 시간(최대 ${MAX_MINUTES}분)`).setMinValue(1).setMaxValue(MAX_MINUTES))
  .addIntegerOption(o => o.setName('주기초').setDescription('갱신 주기(초) 기본 5초').setMinValue(2).setMaxValue(60));

export async function run(i: ChatInputCommandInteraction) {
  const base = i.options.getString('심볼', true);
  const quote = (i.options.getString('통화') ?? 'USDT') as 'KRW'|'USDT'|'USD';
  const minutes = i.options.getInteger('분') ?? 10;
  const periodSec = i.options.getInteger('주기초') ?? 5;

  await i.deferReply();
  const update = async () => {
    const price = await getPrice(base, quote);
    const cached = getCached(base, quote);
    const embed = new EmbedBuilder()
      .setTitle(`👀 Watching ${upper(base)}/${quote}`)
      .addFields({ name: '현재가', value: `**${toFixedNice(price)} ${quote}**`, inline: true })
      .setFooter({ text: `소스: ${cached?.src ?? 'n/a'} • ${nowKST()} KST • ${periodSec}s 갱신` });
    return embed;
  };

  try {
    const embed = await update();
    const msg = await i.editReply({ embeds: [embed] });

    let elapsed = 0;
    const timer = setInterval(async () => {
      try {
        const e = await update();
        await msg.edit({ embeds: [e] });
      } catch {}
      elapsed += periodSec;
      if (elapsed >= minutes * 60) clearInterval(timer);
    }, periodSec * 1000);
  } catch (e: any) {
    await i.editReply(`watch 시작 실패: ${e.message ?? e}`);
  }
}
