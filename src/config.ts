import process from 'node:process';

const requireProcessEnv = (name: string): string => {
  if (!process.env[name]) {
    if(Deno.env.get(name) === undefined) {
      throw new Error('You must set the ' + name + ' environment variable');
    }
    return Deno.env.get(name) as string;
  }
  return process.env[name] as string;
};

interface Config {
  discordToken: string;
  ticketCategoryId: string;
  discordClientId: string;
  guildId: string;
  discordStaffRoleId: string;
  ticketsLogsChannelId: string;
  membershipsLogsChannelId: string;
  discordSeniorStaffRoleId: string;
  discordFounderRoleId: string;
  env: string;
}

const config: Config = {
  discordToken: requireProcessEnv('DISCORD_TOKEN'),
  ticketCategoryId: requireProcessEnv('TICKET_CATEGORY_ID'),
  discordClientId: requireProcessEnv('DISCORD_CLIENT_ID'),
  guildId: requireProcessEnv('GUILD_ID'),
  discordStaffRoleId: requireProcessEnv('DISCORD_SUPPORT_ROLE_ID'),
  ticketsLogsChannelId: requireProcessEnv('DISCORD_TICKETS_LOGS_CHANNEL_ID'),
  membershipsLogsChannelId: requireProcessEnv(
    'DISCORD_MEMBERSHIPS_LOGS_CHANNEL_ID',
  ),
  discordSeniorStaffRoleId: requireProcessEnv('DISCORD_SENIOR_STAFF_ROLE_ID'),
  discordFounderRoleId: requireProcessEnv('DISCORD_FOUNDER_ROLE_ID'),
  env: process.env.NODE_ENV || 'development',
};

export default config;
