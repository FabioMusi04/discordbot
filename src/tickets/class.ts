import { createTranscript } from 'discord-html-transcripts';
import { createClaimedEmbed, createClosedEmbed, createTicketEmbed, fetchTicketMessage, loadTicketsFromJson, saveTicketsToJson } from './utils';
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
  Collection,
  ButtonInteraction
} from 'discord.js';

import config from '../config';


export class TicketManager {
  private ticketCategoryId: string;
  private activeTickets: Collection<string, string> = new Collection();
  private claimedTickets: Collection<string, string> = new Collection();

  constructor(ticketCategoryId: string) {
    this.ticketCategoryId = ticketCategoryId;

    const { activeTickets, claimedTickets } = loadTicketsFromJson() ||
      { activeTickets: new Collection<string, string>(), claimedTickets: new Collection<string, string>() };

    this.activeTickets = activeTickets;
    this.claimedTickets = claimedTickets;
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
            id: config.discordStaffRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
          }
        ],
      });

      this.activeTickets.set(interaction.user.id, ticketChannel.id);

      saveTicketsToJson(this.activeTickets, this.claimedTickets);

      const embed = createTicketEmbed(reason, robloxUsername, description);

      const claimButton = new ButtonBuilder()
        .setCustomId("claim_ticket")
        .setLabel("Claim Ticket")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(claimButton);

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

    const channelClaimerId = this.claimedTickets.get(channel.id);
    if (!channelClaimerId) {
      return interaction.reply({ content: "You cannot close a ticket that you haven't claimed.", ephemeral: true });
    }

    if (channelClaimerId !== interaction.user.id) {
      return interaction.reply({ content: "You cannot close a ticket that you haven't claimed.", ephemeral: true });
    }

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

    this.claimedTickets.forEach((userId, channelId) => {
      if (channelId === channel.id) {
        this.claimedTickets.delete(channelId);
      }
    });

    saveTicketsToJson(this.activeTickets, this.claimedTickets);

    await interaction.editReply({ content: 'Ticket will be closed in 5 seconds...' });
    setTimeout(async () => {
      const channelExists = interaction.guild?.channels.cache.has(channel.id);
      if (channelExists) {
        await channel.delete();
      }
    }, 5000);
  }

  public async claimTicket(interaction: Interaction) {
    if (!interaction.isButton()) return;

    const channel = interaction.channel as TextChannel;
    if (!channel) return;

    const existingClaimerId = this.claimedTickets.get(interaction.user.id);

    if (existingClaimerId && existingClaimerId !== interaction.user.id) {
      return interaction.reply({ content: "This ticket has already been claimed by someone else.", ephemeral: true });
    }

    if (existingClaimerId === channel.id) {
      await this.askMoreSupport(interaction, channel);
      return;
    }

    if (!existingClaimerId) {
      this.claimedTickets.set(channel.id, interaction.user.id);
      saveTicketsToJson(this.activeTickets, this.claimedTickets);

      await channel.setName(`${channel.name}-c`);

      const ticketMessage = await fetchTicketMessage(channel);
      if (ticketMessage && ticketMessage.embeds[0]) {
        const updatedEmbed = EmbedBuilder.from(ticketMessage.embeds[0])
          .setFooter({ text: `Claimed by: ${interaction.user.tag}` })
          .setColor("Yellow");

        const message = await ticketMessage.edit({
          embeds: [updatedEmbed],
          components: [this.createTicketButtons(true, false)]
        });
        message.pin();
      }

      const embed = createClaimedEmbed(interaction.user.tag);
      const message = await channel.send({ embeds: [embed] });
      message.pin();

      await interaction.reply({ content: "You have claimed this ticket.", ephemeral: true });
      return;
    }

    await interaction.reply({
      content: "This ticket has already been claimed by someone else.",
      ephemeral: true
    });
  }

  private async askMoreSupport(interaction: ButtonInteraction, channel: TextChannel) {
    const guild = interaction.guild;
    if (!guild) return;

    const foundersRole = guild.roles.cache.get(config.discordFounderRoleId);
    const seniorHelps = guild.roles.cache.get(config.discordSeniorStaffRoleId);
    const staffRole = guild.roles.cache.get(config.discordStaffRoleId);

    if (foundersRole && seniorHelps && staffRole) {
      await channel.permissionOverwrites.edit(staffRole, {
        ViewChannel: false
      });

      await channel.send({
        content: `Attention ${foundersRole} ${seniorHelps}, this ticket requires your attention.`,
      });
    }

    const ticketMessage = await fetchTicketMessage(channel);
    if (ticketMessage && ticketMessage.embeds[0]) {
      const updatedEmbed = EmbedBuilder.from(ticketMessage.embeds[0])
        .setFooter({ text: `Claimed by: ${interaction.user.tag} | Waiting for more support.` })
        .setColor("Blue");

      const message = await ticketMessage.edit({
        embeds: [updatedEmbed],
        components: [this.createTicketButtons(true, true)]
      });
      message.pin();
    }

    await interaction.reply({
      content: "You have requested more support. Founders and senior staff have been notified.",
      ephemeral: true
    });
  }

  private createTicketButtons(isClaimed: boolean, alreadyAskedSupport: boolean): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('claim_ticket')
          .setLabel(isClaimed ? 'Ask More Support' : 'Claim Ticket')
          .setStyle(isClaimed ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(alreadyAskedSupport)
      );

    if (isClaimed) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
      );
    }
    return row;
  }
}
