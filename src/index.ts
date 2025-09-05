import { Client, GatewayIntentBits, REST, Routes, Events, Interaction } from 'discord.js';
import { ENV } from './lib/env';
import * as price from './commands/price';
import * as watch from './commands/watch';

const commands = [price, watch];

async function registerCommandsGlobally() {
  const rest = new REST({ version: '10' }).setToken(ENV.TOKEN);
  await rest.put(
    Routes.applicationCommands(ENV.APP_ID),
    { body: commands.map(c => c.data.toJSON()) }
  );
  console.log('✓ Slash commands registered (global)');
}

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user?.tag}`);
    if (process.argv.includes('--register')) {
      await registerCommandsGlobally();
      process.exit(0);
    }
  });

  client.on(Events.InteractionCreate, async (i: Interaction) => {
    try {
      if (!i.isChatInputCommand()) return;
      if (i.commandName === price.data.name) return price.run(i);
      if (i.commandName === watch.data.name) return watch.run(i);
    } catch (e) {
      if (i.isRepliable()) await i.reply({ content: '에러가 발생했어요.', ephemeral: true });
      console.error(e);
    }
  });

  await client.login(ENV.TOKEN);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
