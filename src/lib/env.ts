import 'dotenv/config';

export const ENV = {
  TOKEN: process.env.DISCORD_TOKEN!,
  APP_ID: process.env.DISCORD_APP_ID!,
};

for (const [k, v] of Object.entries(ENV)) {
  if (!v) throw new Error(`Missing env: ${k}`);
}
