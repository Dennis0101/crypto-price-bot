// src/index.ts
import { Client, GatewayIntentBits, REST, Routes, Events, Interaction } from 'discord.js';
import * as price from './commands/price';
import * as watch from './commands/watch';

const commands = [price, watch];

async function registerCommandsGlobally(appId: string, token: string) {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationCommands(appId), {
    body: commands.map((c) => c.data.toJSON()),
  });
  console.log('✓ Slash commands registered (global)');
}

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const appId = process.env.DISCORD_APP_ID;
  const wantRegister = process.argv.includes('--register');

  // ✅ 항상 필요한 건 토큰
  if (!token) {
    throw new Error('❌ 환경 변수 DISCORD_TOKEN이 설정되지 않았습니다.');
  }
  // ✅ 커맨드 등록을 하려는 경우에만 APP_ID 필요
  if (wantRegister && !appId) {
    throw new Error('❌ --register 실행에는 DISCORD_APP_ID가 필요합니다.');
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, async () => {
    console.log(`✅ Logged in as ${client.user?.tag}`);
    if (wantRegister) {
      await registerCommandsGlobally(appId!, token);
      process.exit(0);
    }
  });

  client.on(Events.InteractionCreate, async (i: Interaction) => {
    try {
      if (!i.isChatInputCommand()) return;
      if (i.commandName === price.data.name) return price.run(i);
      if (i.commandName === watch.data.name) return watch.run(i);
    } catch (e) {
      console.error(e);
      if (i.isRepliable()) {
        await i.reply({ content: '에러가 발생했어요.', ephemeral: true });
      }
    }
  });

  // 🔑 토큰만으로 로그인
  await client.login(process.env.DISCORD_TOKEN);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
