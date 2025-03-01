import {
  askMoreSupport,
  createClaimedEmbed,
  createTicketButtons,
  createTicketChannel,
  createTicketEmbed,
  createTicketModal,
  fetchTicketMessage,
  getModalValues,
  handleTicketClosure,
  loadTicketsFromKv,
  saveTicketsToKv,
} from './utils/index.ts';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CategoryChannel,
  ChatInputCommandInteraction,
  Collection,
  EmbedBuilder,
  Interaction,
  TextChannel,
} from 'discord.js';

import config from '../config.ts';

export class TicketManager {
  private ticketCategoryId: string;
  private activeTickets: Collection<string, string> = new Collection();
  private claimedTickets: Collection<string, string> = new Collection();

  constructor(ticketCategoryId: string) {
    this.ticketCategoryId = ticketCategoryId;
    this.initialize();
  }

  private async initialize() {
    const { activeTickets, claimedTickets } = await loadTicketsFromKv();
    if (activeTickets) this.activeTickets = activeTickets;
    if (claimedTickets) this.claimedTickets = claimedTickets;
  }

  public async createTicket(interaction: ChatInputCommandInteraction) {
    if (this.activeTickets.has(interaction.user.id)) {
      return interaction.reply({
        content: 'You already have an active ticket!',
        ephemeral: true,
      });
    }

    const modal = createTicketModal();
    await interaction.showModal(modal);

    try {
      const modalSubmission = await interaction.awaitModalSubmit({
        time: 300000,
        filter: (i) =>
          i.customId === 'ticket_modal' && i.user.id === interaction.user.id,
      });

      const { reason, robloxUsername, description } = getModalValues(
        modalSubmission,
      );

      const guild = interaction.guild;
      if (!guild) return;

      const category = guild.channels.cache.get(
        this.ticketCategoryId,
      ) as CategoryChannel;
      if (!category) {
        return modalSubmission.reply({
          content: 'Ticket category not found.',
          ephemeral: true,
        });
      }

      const ticketChannel = await createTicketChannel(
        guild,
        interaction.user,
        category,
      );

      this.activeTickets.set(interaction.user.id, ticketChannel.id);
      await saveTicketsToKv(this.activeTickets, this.claimedTickets);

      const embed = createTicketEmbed(reason, robloxUsername, description);
      const claimButton = new ButtonBuilder()
        .setCustomId('claim_ticket')
        .setLabel('Claim Ticket')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        claimButton,
      );

      await ticketChannel.send({
        content: `<@${interaction.user.id}>`,
        embeds: [embed],
        components: [row],
      });

      await modalSubmission.reply({
        content: `Your ticket has been created: ${ticketChannel}`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('Error handling modal submission:', error);
      await interaction.followUp({
        content: 'Failed to create ticket. Please try again.',
        ephemeral: true,
      });
    }
  }

  public async closeTicket(interaction: ButtonInteraction) {
    if (!interaction.isButton()) return;

    const channel = interaction.channel as TextChannel;
    if (!channel) return;

    const channelClaimerId = this.claimedTickets.get(channel.id);
    if (!channelClaimerId || channelClaimerId !== interaction.user.id) {
      return interaction.reply({
        content: "You cannot close a ticket that you haven't claimed.",
        ephemeral: true,
      });
    }

    const logsChannel = interaction.guild?.channels.cache.get(
      config.ticketsLogsChannelId,
    ) as TextChannel;
    if (logsChannel) {
      await handleTicketClosure(interaction, channel, logsChannel);
    }

    this.removeTicketFromCollections(channel.id);

    await saveTicketsToKv(this.activeTickets, this.claimedTickets);

    await interaction.editReply({
      content: 'Ticket will be closed in 5 seconds...',
    });
    setTimeout(async () => {
      const channelExists = interaction.guild?.channels.cache.has(channel.id);
      if (channelExists) {
        await channel.delete();
      }
    }, 5000);
  }

  private removeTicketFromCollections(channelId: string) {
    this.activeTickets.forEach((id, userId) => {
      if (id === channelId) {
        this.activeTickets.delete(userId);
      }
    });

    this.claimedTickets.forEach((_userId, id) => {
      if (id === channelId) {
        this.claimedTickets.delete(channelId);
      }
    });
  }

  public async claimTicket(interaction: Interaction) {
    if (!interaction.isButton()) return;

    const channel = interaction.channel as TextChannel;
    if (!channel) return;

    const existingClaimerId = this.claimedTickets.get(channel.id);

    if (existingClaimerId && existingClaimerId !== interaction.user.id) {
      return interaction.reply({
        content: 'This ticket has already been claimed by someone else.',
        ephemeral: true,
      });
    }

    if (existingClaimerId && existingClaimerId === interaction.user.id) {
      await askMoreSupport(interaction as ButtonInteraction, channel);
      return;
    }

    if (!existingClaimerId) {
      await this.handleTicketClaim(interaction, channel);
    }
  }

  private async handleTicketClaim(
    interaction: ButtonInteraction,
    channel: TextChannel,
  ) {
    this.claimedTickets.set(channel.id, interaction.user.id);
    await saveTicketsToKv(this.activeTickets, this.claimedTickets);

    await channel.setName(`${channel.name}-c`);

    const ticketMessage = await fetchTicketMessage(channel);
    if (ticketMessage && ticketMessage.embeds[0]) {
      const updatedEmbed = EmbedBuilder.from(ticketMessage.embeds[0])
        .setFooter({ text: `Claimed by: ${interaction.user.tag}` })
        .setColor('Yellow');

      const message = await ticketMessage.edit({
        embeds: [updatedEmbed],
        components: [createTicketButtons(true, false)],
      });
      message.pin();
    }

    const embed = createClaimedEmbed(interaction.user.tag);
    const message = await channel.send({ embeds: [embed] });
    message.pin();

    await interaction.reply({
      content: 'You have claimed this ticket.',
      ephemeral: true,
    });
  }
}
