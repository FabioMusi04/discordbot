import { SlashCommandBuilder } from 'discord.js';

export const ticketCommand = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Creates a support ticket");