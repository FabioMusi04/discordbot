import { TextChannel, CategoryChannel, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';

export class TicketManager {
  private ticketCategoryId: string; 

  constructor(ticketCategoryId: string) {
    this.ticketCategoryId = ticketCategoryId;
  }

  public async createTicket(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) return;

    const category = guild.channels.cache.get(this.ticketCategoryId) as CategoryChannel;
    if (!category) {
      return interaction.reply({ content: "Ticket category not found.", ephemeral: true });
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
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
        {
          id: 'SUPPORT_ROLE_ID',
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        }
      ],
    });

    const embed = new EmbedBuilder()
      .setTitle("Ticket Created")
      .setDescription("Support will be with you shortly.")
      .setColor("Blue");

    const closeButton = new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);

    await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });

    await interaction.reply({ content: `Your ticket has been created: ${ticketChannel}`, ephemeral: true });
  }

  public async closeTicket(channel: TextChannel) {
    await channel.send("Closing ticket in 5 seconds...");
    setTimeout(() => channel.delete(), 5000);
  }
}
