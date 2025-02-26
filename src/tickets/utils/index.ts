import { Collection, EmbedBuilder, TextChannel } from 'discord.js';

import fs from 'fs';

const TICKETS_FILE = 'tickets.json';

export function createTicketEmbed(reason: string, robloxUsername: string, description?: string) {
  return new EmbedBuilder()
    .setTitle("Ticket Created")
    .setDescription("Support will be with you shortly.")
    .addFields(
      { name: 'Reason', value: reason },
      { name: 'Roblox Username', value: robloxUsername },
      { name: 'Additional Information', value: description || 'No additional information provided' }
    )
    .setColor("Blue");
}

export function createClaimedEmbed(userTag: string) {
  return new EmbedBuilder()
    .setTitle("Ticket Claimed")
    .setDescription(`This ticket has been claimed by ${userTag}`)
    .setColor("Green");
}

export function createClosedEmbed(channelName: string, userTag: string) {
  return new EmbedBuilder()
    .setTitle(`Ticket Closed: ${channelName}`)
    .setDescription(`Ticket closed by ${userTag}`)
    .setColor("Red");
}

export async function fetchTicketMessage(channel: TextChannel) {
  const messages = await channel.messages.fetch({ limit: 10 });
  return messages.find(msg => msg.embeds.length > 0 && msg.components.length > 0);
}

export async function saveTicketsToJson(activeTickets: Collection<string, string>, claimedTickets: Collection<string, string>) {
  const data = {
    activeTickets: Object.fromEntries(activeTickets),
    claimedTickets: Object.fromEntries(claimedTickets),
  };
  
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(data, null, 2));
}

export function loadTicketsFromJson(): { activeTickets: Collection<string, string>, claimedTickets: Collection<string, string> } | undefined {
  if (!fs.existsSync(TICKETS_FILE)) return;
  
  try {
    const data = JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf-8'));
    const activeTickets = new Collection<string, string>(Object.entries(data.activeTickets || {}));
    const claimedTickets = new Collection<string, string>(Object.entries(data.claimedTickets || {}));
    return { activeTickets, claimedTickets };
  } catch (error) {
    console.error('Error loading tickets from JSON:', error);
  }
}