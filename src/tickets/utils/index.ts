import { Collection, EmbedBuilder, TextChannel } from 'discord.js';
import DataBase from '../../db/index.ts';

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
