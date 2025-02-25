import {
  TextChannel,
  CategoryChannel,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Interaction,
  Collection
} from 'discord.js';
import { createTranscript } from 'discord-html-transcripts';
import { createClaimedEmbed, createClosedEmbed, createTicketEmbed, fetchTicketMessage } from './utils';

import config from '../config';

export class TicketManager {
  private ticketCategoryId: string;
  private activeTickets: Collection<string, string> = new Collection();
  private claimedTickets: Collection<string, string> = new Collection();

  constructor(ticketCategoryId: string) {
    this.ticketCategoryId = ticketCategoryId;
  }

  public async createTicket(interaction: ChatInputCommandInteraction) {
    if (this.activeTickets.has(interaction.user.id)) {
      return interaction.reply({
        content: "You already have an active ticket!",
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId('ticket_modal')
      .setTitle('Create a Ticket');

    const reasonInput = new TextInputBuilder()
      .setCustomId('ticket_reason')
      .setLabel('Reason for ticket')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const robloxInput = new TextInputBuilder()
      .setCustomId('roblox_username')
      .setLabel('Roblox Username')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('ticket_description')
      .setLabel('Additional Information')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
    const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(robloxInput);
    const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);

    modal.addComponents(firstRow, secondRow, thirdRow);

    await interaction.showModal(modal);

    try {
      const modalSubmission = await interaction.awaitModalSubmit({
        time: 300000,
        filter: i => i.customId === 'ticket_modal' && i.user.id === interaction.user.id,
      });

      const reason = modalSubmission.fields.getTextInputValue('ticket_reason');
      const robloxUsername = modalSubmission.fields.getTextInputValue('roblox_username');
      const description = modalSubmission.fields.getTextInputValue('ticket_description');

      const guild = interaction.guild;
      if (!guild) return;

      const category = guild.channels.cache.get(this.ticketCategoryId) as CategoryChannel;
      if (!category) {
        return modalSubmission.reply({ content: "Ticket category not found.", ephemeral: true });
      }

      const ticketChannel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: 0,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
          },
          {
            id: config.discordRoleSupportId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
          }
        ],
      });

      this.activeTickets.set(interaction.user.id, ticketChannel.id);

      const embed = createTicketEmbed(reason, robloxUsername, description);

      const closeButton = new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger);

      const claimButton = new ButtonBuilder()
        .setCustomId("claim_ticket")
        .setLabel("Claim Ticket")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(claimButton, closeButton);

      await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });

      await modalSubmission.reply({ content: `Your ticket has been created: ${ticketChannel}`, ephemeral: true });
    } catch (error) {
      console.error('Error handling modal submission:', error);
      await interaction.followUp({ content: 'Failed to create ticket. Please try again.', ephemeral: true });
    }
  }

  public async closeTicket(interaction: Interaction) {
    if (!interaction.isButton()) return;

    const channel = interaction.channel as TextChannel;
    if (!channel) return;

    const logsChannel = interaction.guild?.channels.cache.get(config.ticketsLogsChannelId) as TextChannel;
    if (logsChannel) {
      await interaction.reply({ content: 'Closing ticket...', ephemeral: true });
      const generatingMsg = await logsChannel.send('Generating transcript...');

      const transcript = await createTranscript(channel, {
        limit: -1,
        filename: `transcript-${channel.name}.html`,
      });

      const msg = await logsChannel.send({ files: [transcript] });

      const button = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel("Open Transcript")
            .setURL(`https://mahto.id/chat-exporter?url=${msg.attachments.first()?.url}`)
            .setStyle(ButtonStyle.Link),

          new ButtonBuilder()
            .setLabel("Download Transcript")
            .setURL(`${msg.attachments.first()?.url}`)
            .setStyle(ButtonStyle.Link)
        );

      const embed = createClosedEmbed(channel.name, interaction.user.tag);
      await generatingMsg.delete();
      await logsChannel.send({ embeds: [embed], components: [button] });
    }

    this.activeTickets.forEach((channelId, userId) => {
      if (channelId === channel.id) {
        this.activeTickets.delete(userId);
      }
    });

    await interaction.editReply({ content: 'Ticket will be closed in 5 seconds...' });
    setTimeout(() => channel.delete(), 5000);
  }

  public async claimTicket(interaction: Interaction) {
    if (!interaction.isButton()) return;

    const channel = interaction.channel as TextChannel;
    if (!channel) return;

    if (this.claimedTickets.has(channel.id)) {
      return interaction.reply({ content: "This ticket has already been claimed!", ephemeral: true });
    }

    this.claimedTickets.set(channel.id, interaction.user.id);

    const ticketMessage = await fetchTicketMessage(channel);

    if (ticketMessage && ticketMessage.embeds[0]) {
      const updatedEmbed = EmbedBuilder.from(ticketMessage.embeds[0])
        .setFooter({ text: `Claimed by: ${interaction.user.tag}` })
        .setColor("Yellow");

      await ticketMessage.edit({ embeds: [updatedEmbed] });
    }

    const embed = createClaimedEmbed(interaction.user.tag);
    await channel.send({ embeds: [embed] });
    await interaction.reply({ content: "You have claimed this ticket", ephemeral: true });
  }

}
