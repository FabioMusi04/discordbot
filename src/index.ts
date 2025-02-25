import { Client, Events } from 'discord.js';
import { Intents } from './gatewayIntentBits';
import { TicketManager } from './tickets/class';

import config from './config';

export class DiscordBot {
  private static instance: DiscordBot;
  private client: Client;
  private ticketManager: TicketManager | null = null;

  private constructor() {
    this.client = new Client({
      intents: Intents,
    });

    this.client.once(Events.ClientReady, async (readyClient) => {
      this.ticketManager = new TicketManager(config.ticketCategoryId);
      console.log(`Logged in as ${readyClient.user?.tag}`);
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!this.ticketManager) return;
      if (!interaction.isChatInputCommand()) return;

      if (interaction.commandName === 'ticket') {
        await this.ticketManager.createTicket(interaction);
      }
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