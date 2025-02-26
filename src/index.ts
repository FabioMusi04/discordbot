import { Client, Events, TextChannel } from 'discord.js';
import { Intents } from './gatewayIntentBits';
import { TicketManager } from './tickets/class';
import { MembershipManager } from './membership/class';
import { checkExpiredRoles } from './membership/utils';

import config from './config';

export class DiscordBot {
  private static instance: DiscordBot;
  private client: Client;
  private ticketManager: TicketManager | null = null;
  private membershipManager: MembershipManager | null = null;

  private constructor() {
    this.client = new Client({
      intents: Intents,
    });

    this.client.once(Events.ClientReady, async (readyClient) => {
      await checkExpiredRoles(readyClient);

      this.ticketManager = new TicketManager(config.ticketCategoryId);
      this.membershipManager = new MembershipManager(this.client);
      
      console.log(`Logged in as ${readyClient.user?.tag}`);
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!this.ticketManager) return;

      if (interaction.isButton() && interaction.customId === "close_ticket") {
        if (interaction.channel?.isTextBased()) {
          await this.ticketManager.closeTicket(interaction);
        }
      }

      if (interaction.isButton() && interaction.customId === 'claim_ticket') {
        if (interaction.channel?.isTextBased()) {
          await this.ticketManager.claimTicket(interaction);
        }
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'ticket') {
        await this.ticketManager.createTicket(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'm-membership') {
        await this.membershipManager?.assignMembership(interaction);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'm-unmembership') {
        await this.membershipManager?.removeMembership(interaction);
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