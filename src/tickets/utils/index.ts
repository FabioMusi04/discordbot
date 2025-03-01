import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CategoryChannel,
  Collection,
  EmbedBuilder,
  Guild,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  User,
} from 'discord.js';
import DataBase from '../../db/index.ts';
import config from '../../config.ts';
import { createTranscript } from 'discord-html-transcripts';

export function createTicketEmbed(
  reason: string,
  robloxUsername: string,
  description?: string,
) {
  return new EmbedBuilder()
    .setTitle('Ticket Created')
    .setDescription('Support will be with you shortly.')
    .addFields(
      { name: 'Reason', value: reason },
      { name: 'Roblox Username', value: robloxUsername },
      {
        name: 'Additional Information',
        value: description || 'No additional information provided',
      },
    )
    .setColor('Blue');
}

export function createClaimedEmbed(userTag: string) {
  return new EmbedBuilder()
    .setTitle('Ticket Claimed')
    .setDescription(`This ticket has been claimed by ${userTag}`)
    .setColor('Green');
}

export function createClosedEmbed(channelName: string, userTag: string) {
  return new EmbedBuilder()
    .setTitle(`Ticket Closed: ${channelName}`)
    .setDescription(`Ticket closed by ${userTag}`)
    .setColor('Red');
}

export async function fetchTicketMessage(channel: TextChannel) {
  const messages = await channel.messages.fetch({ limit: 10 });
  return messages.find((msg) =>
    msg.embeds.length > 0 && msg.components.length > 0
  );
}

export async function saveTicketsToKv(
  activeTickets: Collection<string, string>,
  claimedTickets: Collection<string, string>,
) {
  const kv = await DataBase.getInstance();
  await kv.set(['activeTickets'], activeTickets);
  await kv.set(['claimedTickets'], claimedTickets);
}

export async function loadTicketsFromKv() {
  const kv = await DataBase.getInstance();
  const activeTicketsData = await kv.get(['activeTickets']);
  const claimedTicketsData = await kv.get(['claimedTickets']);

  const activeTickets = new Collection<string, string>();
  const claimedTickets = new Collection<string, string>();

  if (activeTicketsData) {
    Object.entries(activeTicketsData).forEach(([key, value]) => {
      activeTickets.set(key, value as string);
    });
  }

  if (claimedTicketsData) {
    Object.entries(claimedTicketsData).forEach(([key, value]) => {
      claimedTickets.set(key, value as string);
    });
  }

  return { activeTickets, claimedTickets };
}

export function createTicketModal(): ModalBuilder {
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

  const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    reasonInput,
  );
  const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    robloxInput,
  );
  const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    descriptionInput,
  );

  modal.addComponents(firstRow, secondRow, thirdRow);
  return modal;
}

export function getModalValues(modalSubmission: ModalSubmitInteraction) {
  const reason = modalSubmission.fields.getTextInputValue('ticket_reason');
  const robloxUsername = modalSubmission.fields.getTextInputValue(
    'roblox_username',
  );
  const description = modalSubmission.fields.getTextInputValue(
    'ticket_description',
  );
  return { reason, robloxUsername, description };
}

export async function createTicketChannel(
  guild: Guild,
  user: User,
  category: CategoryChannel,
) {
  return await guild.channels.create({
    name: `ticket-${user.username}`,
    type: 0,
    parent: category.id,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: config.discordStaffRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
        ],
      },
    ],
  });
}

export async function handleTicketClosure(
  interaction: ButtonInteraction,
  channel: TextChannel,
  logsChannel: TextChannel,
) {
  await interaction.reply({
    content: 'Closing ticket...',
    ephemeral: true,
  });
  const generatingMsg = await logsChannel.send('Generating transcript...');

  const transcript = await createTranscript(channel as any, {
    limit: -1,
    filename: `transcript-${channel.name}.html`,
  });

  const msg = await logsChannel.send({ files: [transcript] });

  const button = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Open Transcript')
        .setURL(
          `https://mahto.id/chat-exporter?url=${msg.attachments.first()?.url}`,
        )
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel('Download Transcript')
        .setURL(`${msg.attachments.first()?.url}`)
        .setStyle(ButtonStyle.Link),
    );

  const embed = createClosedEmbed(channel.name, interaction.user.tag);
  await generatingMsg.delete();
  await logsChannel.send({ embeds: [embed], components: [button] });
}

export async function askMoreSupport(
  interaction: ButtonInteraction,
  channel: TextChannel,
) {
  const guild = interaction.guild;
  if (!guild) return;

  const foundersRole = guild.roles.cache.get(config.discordFounderRoleId);
  const seniorHelps = guild.roles.cache.get(config.discordSeniorStaffRoleId);
  const staffRole = guild.roles.cache.get(config.discordStaffRoleId);

  if (foundersRole && seniorHelps && staffRole) {
    await channel.permissionOverwrites.edit(staffRole, {
      ViewChannel: false,
    });

    await channel.send({
      content:
        `Attention ${foundersRole} ${seniorHelps}, this ticket requires your attention.`,
    });
  }

  const ticketMessage = await fetchTicketMessage(channel);
  if (ticketMessage && ticketMessage.embeds[0]) {
    const updatedEmbed = EmbedBuilder.from(ticketMessage.embeds[0])
      .setFooter({
        text: `Claimed by: ${interaction.user.tag} | Waiting for more support.`,
      })
      .setColor('Blue');

    const message = await ticketMessage.edit({
      embeds: [updatedEmbed],
      components: [createTicketButtons(true, true)],
    });
    message.pin();
  }

  await interaction.reply({
    content:
      'You have requested more support. Founders and senior staff have been notified.',
    ephemeral: true,
  });
}

export function createTicketButtons(
  isClaimed: boolean,
  alreadyAskedSupport: boolean,
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('claim_ticket')
        .setLabel(isClaimed ? 'Ask More Support' : 'Claim Ticket')
        .setStyle(isClaimed ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(alreadyAskedSupport),
    );

  if (isClaimed) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger),
    );
  }
  return row;
}
