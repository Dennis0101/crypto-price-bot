// src/panel.ts
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  TextChannel, NewsChannel, ThreadChannel,
  Client, ButtonInteraction, ModalSubmitInteraction, PermissionFlagsBits
} from 'discord.js';
import { getPrice } from './lib/prices';
import { toFixedNice, upper, nowKST } from './lib/util';

export async function ensurePanel(client: Client, channelId: string) {
  console.log('[panel] ensurePanel start. CHANNEL_ID =', channelId);
  try {
    const ch = await client.channels.fetch(channelId);
    if (!ch) throw new Error('channel not found');

    // 텍스트 전송 가능한 채널만 허용
    const isTextLike = ch instanceof TextChannel || ch instanceof NewsChannel || ch instanceof ThreadChannel;
    if (!isTextLike || !('send' in ch)) {
      throw new Error(`channel not text-based. type=${(ch as any).type}`);
    }

    // 권한 체크
    const me = ch.guild.members.me ?? await ch.guild.members.fetchMe();
    const perms = ch.permissionsFor(me);
    if (!perms?.has(PermissionFlagsBits.ViewChannel)) throw new Error('missing permission: ViewChannel');
    if (!perms?.has(PermissionFlagsBits.SendMessages)) throw new Error('missing permission: SendMessages');
    if (!perms?.has(PermissionFlagsBits.EmbedLinks)) console.warn('[panel] warning: missing EmbedLinks');

    const embed = new EmbedBuilder()
      .setTitle('💹 코인 패널')
      .setDescription('버튼을 눌러 바로 실행하세요.')
      .setFooter({ text: '실시간 시세/감시 패널' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('panel:price').setLabel('현재가 조회').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('panel:watch').setLabel('실시간 감시 시작').setStyle(ButtonStyle.Success),
    );

    await (ch as TextChannel).send({ embeds: [embed], components: [row] });
    console.log('[panel] sent.');
  } catch (e: any) {
    console.error('[panel] failed:', e?.message ?? e);
  }
}

export async function handleButton(i: ButtonInteraction) {
  if (!i.customId.startsWith('panel:')) return;

  if (i.customId === 'panel:price') {
    const modal = new ModalBuilder().setCustomId('modal:price').setTitle('현재가 조회');
    const sym  = new TextInputBuilder().setCustomId('sym').setLabel('심볼 (예: BTC)').setStyle(TextInputStyle.Short).setRequired(true);
    const quo  = new TextInputBuilder().setCustomId('quo').setLabel('통화 KRW/USDT/USD (기본 KRW)').setStyle(TextInputStyle.Short).setRequired(false);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(sym),
      new ActionRowBuilder<TextInputBuilder>().addComponents(quo),
    );
    return i.showModal(modal);
  }

  if (i.customId === 'panel:watch') {
    const modal = new ModalBuilder().setCustomId('modal:watch').setTitle('실시간 감시 시작');
    const sym  = new TextInputBuilder().setCustomId('sym').setLabel('심볼 (예: BTC)').setStyle(TextInputStyle.Short).setRequired(true);
    const quo  = new TextInputBuilder().setCustomId('quo').setLabel('통화 USDT/KRW/USD (기본 USDT)').setStyle(TextInputStyle.Short).setRequired(false);
    const mins = new TextInputBuilder().setCustomId('mins').setLabel('분(1~60, 기본 10)').setStyle(TextInputStyle.Short).setRequired(false);
    const sec  = new TextInputBuilder().setCustomId('sec').setLabel('주기초(2~60, 기본 5)').setStyle(TextInputStyle.Short).setRequired(false);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(sym),
      new ActionRowBuilder<TextInputBuilder>().addComponents(quo),
      new ActionRowBuilder<TextInputBuilder>().addComponents(mins),
      new ActionRowBuilder<TextInputBuilder>().addComponents(sec),
    );
    return i.showModal(modal);
  }
}

export async function handleModal(i: ModalSubmitInteraction) {
  if (i.customId === 'modal:price') {
    const base = i.fields.getTextInputValue('sym').trim().toUpperCase();
    const quote = (i.fields.getTextInputValue('quo')?.trim().toUpperCase() || 'KRW') as 'KRW'|'USDT'|'USD';
    await i.deferReply({ ephemeral: false });
    try {
      const p = await getPrice(base, quote);
      await i.editReply({
        embeds: [{
          title: `${upper(base)}/${quote} 현재가`,
          description: `**${toFixedNice(p)} ${quote}**`,
          footer: { text: nowKST() + ' KST' }
        } as any]
      });
    } catch (e: any) {
      await i.editReply(`가격 조회 실패: ${e.message ?? e}`);
    }
    return;
  }

  if (i.customId === 'modal:watch') {
    const base = i.fields.getTextInputValue('sym').trim().toUpperCase();
    const quote = (i.fields.getTextInputValue('quo')?.trim().toUpperCase() || 'USDT') as 'KRW'|'USDT'|'USD';
    const minutes = Math.max(1, Math.min(60, parseInt(i.fields.getTextInputValue('mins') || '10', 10)));
    const periodSec = Math.max(2, Math.min(60, parseInt(i.fields.getTextInputValue('sec') || '5', 10)));

    await i.deferReply();
    const makeEmbed = async () => {
      const p = await getPrice(base, quote);
      return {
        title: `👀 Watching ${upper(base)}/${quote}`,
        fields: [{ name: '현재가', value: `**${toFixedNice(p)} ${quote}**`, inline: true }],
        footer: { text: `${nowKST()} KST • ${periodSec}s 갱신` }
      } as any;
    };
    try {
      const emb = await makeEmbed();
      const msg = await i.editReply({ embeds: [emb] });
      let elapsed = 0;
      const timer = setInterval(async () => {
        try { const e = await makeEmbed(); await (msg as any).edit({ embeds: [e] }); } catch {}
        elapsed += periodSec;
        if (elapsed >= minutes * 60) clearInterval(timer);
      }, periodSec * 1000);
    } catch (e: any) {
      await i.editReply(`watch 시작 실패: ${e.message ?? e}`);
    }
  }
}
