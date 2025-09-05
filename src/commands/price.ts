// src/commands/price.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getPrice, getCached, getKimchi } from '../lib/prices';     // ✅ getKimchi 추가
import { toFixedNice, upper, nowKST, toPct } from '../lib/util';    // ✅ toPct 추가

export const data = new SlashCommandBuilder()
  .setName('price')
  .setDescription('코인 현재가 조회 (+ 김치 프리미엄 표시)')
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
  const base = i.options.getString('심볼', true).trim().toUpperCase();
  const quote = (i.options.getString('통화') ?? 'KRW') as 'KRW'|'USDT'|'USD';

  await i.deferReply({ ephemeral: false });
  try {
    // 기본 현재가
    const price = await getPrice(base, quote);
    const cached = getCached(base, quote);

    const embed = new EmbedBuilder()
      .setTitle(`${upper(base)}/${quote} 현재가`)
      .setDescription(`**${toFixedNice(price)} ${quote}**`)
      .setFooter({ text: `소스: ${cached?.src ?? 'n/a'} • ${nowKST()} KST` });

    // ✅ 보너스: 김치 프리미엄(Upbit KRW vs Binance USDT) 병행 표시 (실패해도 무시)
    try {
      const k = await getKimchi(base);
      embed.addFields(
        { name: '업비트 (KRW)', value: `${toFixedNice(k.krw)} KRW`, inline: true },
        { name: '바이낸스 (USDT)', value: `${toFixedNice(k.usdt)} USDT`, inline: true },
        { name: 'USD/KRW', value: `${toFixedNice(k.usdkrw, 4)} KRW`, inline: true },
        { name: '김치 프리미엄', value: `**${toPct(k.premium, 2)}**`, inline: false },
      );
    } catch {
      // 환율/거래소 응답 오류 등은 조용히 무시 (현재가만 표시)
    }

    await i.editReply({ embeds: [embed] });
  } catch (e: any) {
    await i.editReply(`가격을 가져오지 못했습니다: ${e.message ?? e}`);
  }
}
