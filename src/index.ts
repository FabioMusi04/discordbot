import syncCommands from './commands/index.ts';

import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  Events,
  type Interaction,
} from 'discord.js';
import { Intents } from './gatewayIntentBits/index.ts';
import { TicketManager } from './tickets/class.ts';
import { MembershipManager } from './membership/class.ts';
import { checkExpiredRoles } from './membership/utils/index.ts';

import config from './config.ts';

export class DiscordBot {
  private static instance: DiscordBot;
  private client: Client;
  private ticketManager: TicketManager | null = null;
  private membershipManager: MembershipManager | null = null;

  private constructor() {
    this.client = new Client({ intents: Intents });
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client.once(Events.ClientReady, this.handleReady.bind(this));
    this.client.on(Events.InteractionCreate, this.handleInteraction.bind(this));
  }

  private async handleReady(readyClient: Client): Promise<void> {
    // await syncCommands();
    await checkExpiredRoles(readyClient);
    this.ticketManager = new TicketManager(config.ticketCategoryId);
    this.membershipManager = new MembershipManager(this.client);
    console.log(`Logged in as ${readyClient.user?.tag}`);
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (!this.ticketManager) return;

    if (interaction.isButton()) {
      await this.handleButtonInteraction(interaction);
    } else if (interaction.isChatInputCommand()) {
      await this.handleCommand(interaction);
    }
  }

  private async handleButtonInteraction(
    interaction: ButtonInteraction,
  ): Promise<void> {
    if (!interaction.channel?.isTextBased()) return;

    switch (interaction.customId) {
      case 'close_ticket':
        await this.ticketManager?.closeTicket(interaction);
        break;
      case 'claim_ticket':
        await this.ticketManager?.claimTicket(interaction);
        break;
    }
  }

  private async handleCommand(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    switch (interaction.commandName) {
      case 'ticket':
        await this.ticketManager?.createTicket(interaction);
        break;
      case 'm-membership':
        await this.membershipManager?.assignMembership(interaction);
        break;
      case 'm-unmembership':
        await this.membershipManager?.removeMembership(interaction);
        break;
    }
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
