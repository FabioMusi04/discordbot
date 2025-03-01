import { SlashCommandBuilder } from 'discord.js';

export const ticketCommands = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Creates a support ticket');
