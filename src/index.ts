// src/index.ts
import { Client, GatewayIntentBits, Events, Interaction, PermissionFlagsBits, REST, Routes } from 'discord.js';
import { ensurePanel, handleButton, handleModal } from './panel';
import * as price from './commands/price';
import * as watch from './commands/watch';

// 슬래시 명령 모음
const commands = [price, watch];

function getArg(name: string) {
  const i = process.argv.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return undefined;
  const eq = process.argv[i].indexOf('=');
  if (eq !== -1) return process.argv[i].slice(eq + 1);
  return process.argv[i + 1];
}

async function registerSlash(appId: string, token: string, guildId?: string) {
  const rest = new REST({ version: '10' }).setToken(token);
  const body = commands.map(c => c.data.toJSON());
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body });
    console.log(`✓ Guild slash registered (guildId=${guildId})`);
  } else {
    await rest.put(Routes.applicationCommands(appId), { body });
    console.log('✓ Global slash registered (전파에 수 분~최대 1시간)');
  }
}

async function main() {
  const token    = process.env.DISCORD_TOKEN;     // 반드시 필요
  const appId    = process.env.DISCORD_APP_ID;    // --register 쓸 때만 필요
  const channelId = process.env.CHANNEL_ID || ''; // 있으면 부팅 시 패널 자동 게시
  const wantRegister = process.argv.includes('--register');
  const guildId  = getArg('guild') || process.env.GUILD_ID; // 선택

  if (!token) throw new Error('❌ DISCORD_TOKEN이 설정되어야 합니다.');
  if (wantRegister && !appId) throw new Error('❌ --register 실행에는 DISCORD_APP_ID가 필요합니다.');

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      // "!패널" 같은 텍스트 명령을 계속 쓰려면 아래 2개 유지 + 개발자 포털에서 Message Content 인텐트 ON
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, async () => {
    console.log(`✅ Logged in as ${client.user?.tag}`);
    if (channelId) await ensurePanel(client, channelId);

    if (wantRegister) {
      await registerSlash(appId!, token, guildId);
      process.exit(0);
    }
  });

  // 버튼/모달/슬래시 처리
  client.on(Events.InteractionCreate, async (i: Interaction) => {
    if (i.isButton()) return handleButton(i);
    if (i.isModalSubmit()) return handleModal(i);
    if (i.isChatInputCommand()) {
      if (i.commandName === price.data.name) return price.run(i);
      if (i.commandName === watch.data.name) return watch.run(i);
    }
  });

  // (선택) "!패널"로 수동 생성
  client.on(Events.MessageCreate, async (m) => {
    if (m.author.bot) return;
    if (!m.content.trim().startsWith('!패널')) return;

    const isAdmin = m.member?.permissions.has(PermissionFlagsBits.Administrator)
                 || m.member?.permissions.has(PermissionFlagsBits.ManageGuild);
    if (!isAdmin) return m.reply('이 명령은 관리자만 사용할 수 있어요.');

    await ensurePanel(client, channelId || m.channel.id);
    await m.reply('✅ 패널을 올렸어요!');
  });

  // 🔑 무조건 env로 로그인
  await client.login(process.env.DISCORD_TOKEN);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
