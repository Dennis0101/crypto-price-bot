// src/panel.ts
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  TextChannel, NewsChannel, ThreadChannel, Client
} from 'discord.js';

export async function ensurePanel(client: Client, channelId: string) {
  console.log('[panel] ensurePanel start. CHANNEL_ID =', channelId);
  try {
    const ch = await client.channels.fetch(channelId);
    if (!ch) throw new Error('channel not found');

    // 텍스트 전송 가능한 채널만 허용
    const textLike = (ch instanceof TextChannel) || (ch instanceof NewsChannel) || (ch instanceof ThreadChannel);
    if (!textLike || !('send' in ch)) {
      throw new Error(`channel not text-based. type=${ch.type}`);
    }

    // 권한 체크(없어도 send에서 터지지만, 원인 로그를 친절히 남김)
    const me = ch.guild.members.me ?? await ch.guild.members.fetchMe();
    const perms = ch.permissionsFor(me);
    if (!perms?.has('ViewChannel')) throw new Error('missing permission: ViewChannel');
    if (!perms?.has('SendMessages')) throw new Error('missing permission: SendMessages');
    if (!perms?.has('EmbedLinks')) console.warn('[panel] warning: missing EmbedLinks (임베드가 안 보일 수 있음)');

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
