// src/index.ts
import { Client, GatewayIntentBits, Events, Interaction } from 'discord.js';
import { ensurePanel, handleButton, handleModal } from './panel';
import * as price from './commands/price';
import * as watch from './commands/watch';

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const channelId = process.env.CHANNEL_ID;

  if (!token) {
    throw new Error('❌ DISCORD_TOKEN 환경 변수가 필요합니다.');
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  // ✅ 봇이 준비되었을 때 패널 띄우기
  client.once(Events.ClientReady, async () => {
    console.log(`✅ Logged in as ${client.user?.tag}`);
    if (channelId) {
      await ensurePanel(client, channelId);
    }
  });

  // ✅ 버튼/모달 핸들링
  client.on(Events.InteractionCreate, async (i: Interaction) => {
    if (i.isButton()) return handleButton(i);
    if (i.isModalSubmit()) return handleModal(i);

    if (i.isChatInputCommand()) {
      if (i.commandName === price.data.name) return price.run(i);
      if (i.commandName === watch.data.name) return watch.run(i);
    }
  });

  // ✅ 무조건 토큰으로 로그인
  await client.login(process.env.DISCORD_TOKEN);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
