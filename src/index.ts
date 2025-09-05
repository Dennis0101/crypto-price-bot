// src/index.ts
import { Client, GatewayIntentBits, Events, Interaction, PermissionFlagsBits } from 'discord.js';
import { ensurePanel, handleButton, handleModal } from './panel';
import * as price from './commands/price';
import * as watch from './commands/watch';

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const channelId = process.env.CHANNEL_ID; // 있으면 이 채널에, 없으면 호출 채널에 올림
  if (!token) throw new Error('❌ DISCORD_TOKEN 환경 변수가 필요합니다.');

  // ✅ 메시지명령을 위해 GuildMessages + MessageContent 인텐트 추가
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // 로그인 완료 시 패널 자동(선택)
  client.once(Events.ClientReady, async () => {
    console.log(`✅ Logged in as ${client.user?.tag}`);
    if (channelId) await ensurePanel(client, channelId);
  });

  // 버튼/모달 처리
  client.on(Events.InteractionCreate, async (i: Interaction) => {
    if (i.isButton()) return handleButton(i);
    if (i.isModalSubmit()) return handleModal(i);
    if (i.isChatInputCommand()) {
      if (i.commandName === price.data.name) return price.run(i);
      if (i.commandName === watch.data.name) return watch.run(i);
    }
  });

  // ✅ 여기서 텍스트 명령어 처리: "!패널"
  client.on(Events.MessageCreate, async (m) => {
    if (m.author.bot) return;
    if (!m.content.trim().startsWith('!패널')) return;

    // (권장) 관리자만 실행 가능하게 제한
    const member = m.member;
    const isAdmin = member?.permissions.has(PermissionFlagsBits.Administrator)
                 || member?.permissions.has(PermissionFlagsBits.ManageGuild);
    if (!isAdmin) {
      return m.reply('이 명령은 관리자만 사용할 수 있어요.');
    }

    try {
      const targetChannelId = channelId ?? m.channel.id; // 환경변수 없으면 현재 채널에 올림
      await ensurePanel(client, targetChannelId);
      await m.reply('✅ 패널을 올렸어요!');
    } catch (e: any) {
      await m.reply(`패널 올리기 실패: ${e?.message ?? e}`);
    }
  });

  // 🔑 반드시 이 줄로 로그인
  await client.login(process.env.DISCORD_TOKEN);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
