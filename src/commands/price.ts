import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getPrice, getCached } from '../lib/prices';
import { toFixedNice, upper, nowKST } from '../lib/util';

export const data = new SlashCommandBuilder()
  .setName('price')
  .setDescription('코인 현재가 조회')
  .addStringOption(o => o.setName('심볼').setDescription('예: BTC, ETH').setRequired(true))
  .addStringOption(o => o
    .setName('통화')
    .setDescription('USDT/KRW/USD (기본: KRW)')
    .addChoices(
      { name: 'KRW (업비트)', value: 'KRW' },
      { name: 'USDT (바이낸스)', value: 'USDT' },
      { name: 'USD (≈USDT)', value: 'USD' },
    )
  );

export async function run(i: ChatInputCommandInteraction) {
  const base = i.options.getString('심볼', true);
  const quote = (i.options.getString('통화') ?? 'KRW') as 'KRW'|'USDT'|'USD';

  await i.deferReply({ ephemeral: false });
  try {
    const price = await getPrice(base, quote);
    const cached = getCached(base, quote);
    const embed = new EmbedBuilder()
      .setTitle(`${upper(base)}/${quote} 현재가`)
      .setDescription(`**${toFixedNice(price)} ${quote}**`)
      .setFooter({ text: `소스: ${cached?.src ?? 'n/a'} • ${nowKST()} KST` });
    await i.editReply({ embeds: [embed] });
  } catch (e: any) {
    await i.editReply(`가격을 가져오지 못했습니다: ${e.message ?? e}`);
  }
}
