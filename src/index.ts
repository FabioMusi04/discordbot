import { Client, Events, GatewayIntentBits } from 'discord.js';
import config from './config';

export class DiscordBot {
  private static instance: DiscordBot;
  private client: Client;

  private constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.client.once(Events.ClientReady, async (readyClient) => {
      console.log(`Logged in as ${readyClient.user?.tag}`);
    });
  }

  public static getInstance(): DiscordBot {
    if (!DiscordBot.instance) {
      DiscordBot.instance = new DiscordBot();
    }
    return DiscordBot.instance;
  }

  public async start(): Promise<void> {
    await this.client.login(config.discordToken);
  }

  public getClient(): Client {
    return this.client;
  }
}

const bot = DiscordBot.getInstance();
await bot.start();