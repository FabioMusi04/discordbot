import {
  type Client,
  Collection,
  EmbedBuilder,
  type Guild,
  type TextChannel,
} from 'discord.js';

import DataBase from '../../db/index.ts';
import config from '../../config.ts';

export interface Membership {
  userId: string;
  guildId: string;
  expiresAt: number | null;
  roleId: string;
}

/**
 * Parses a duration string and converts it to milliseconds.
 */
export function parseDuration(duration: string): number | null {
  if (duration.toLowerCase() === 'perm') return null;

  const match = duration.match(/(\d+)([hmds])/);
  if (!match || !match[1] || !match[2]) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const unitMs: { [key: string]: number } = {
    h: 60 * 60 * 1000, // 1 hour
    d: 24 * 60 * 60 * 1000, // 1 day
    m: 60 * 1000, // 1 minute
    s: 1000, // 1 second
  };

  return unitMs[unit] ? value * unitMs[unit] : null;
}

/**
 * Loads stored memberships from file.
 */
export async function loadMemberships(): Promise<
  Collection<string, Membership>
> {
  const kv = await DataBase.getInstance();
  await kv.delete(['memberships']);

  const membershipsData = await kv.get(['memberships']);
  const memberships = new Collection<string, Membership>();

  if (!membershipsData) return memberships;

  if (!membershipsData.value) return memberships;

  Object.values(membershipsData).forEach(([key, value]) => {
    memberships.set(key, value as Membership);
  });

  return memberships || [];
}

/**
 * Saves memberships to file.
 */
export async function saveMemberships(
  memberships: Collection<string, Membership>,
) {
  const kv = await DataBase.getInstance();
  await kv.set(['memberships'], memberships);
}

/**
 * Logs role removals to the designated log channel.
 */
export async function logRoleChange(
  guild: Guild,
  userId: string,
  roleId: string,
  action: 'added' | 'removed',
  success: boolean,
  errorMessage?: string,
) {
  const logChannel = guild.channels.cache.get(
    config.membershipsLogsChannelId,
  ) as TextChannel;
  if (!logChannel) return;

  const user = await guild.members.fetch(userId);
  const role = guild.roles.cache.get(roleId);

  if (!user || !role) return;

  const embed = new EmbedBuilder()
    .setColor(
      success ? (action === 'added' ? '#00ff00' : '#ff0000') : '#ff6b6b',
    )
    .setTitle(
      `Membership Role ${action.charAt(0).toUpperCase() + action.slice(1)}`,
    )
    .setThumbnail(user.user.displayAvatarURL())
    .addFields(
      { name: 'User', value: `${user} (${user.user.tag})`, inline: true },
      { name: 'Role', value: role.name, inline: true },
      { name: 'Status', value: success ? 'Success' : 'Failed', inline: true },
    )
    .setTimestamp();

  if (!success && errorMessage) {
    embed.addFields({ name: 'Error', value: errorMessage, inline: false });
  }

  await logChannel.send({ embeds: [embed] });
}

/**
 * Removes a role from a user and logs the action.
 */
export async function removeRole(
  guild: Guild,
  userId: string,
  roleId: string,
  hasToLog: boolean = true,
): Promise<void> {
  try {
    const user = await guild.members.fetch(userId);
    if (!user) return;

    const role = guild.roles.cache.get(roleId);
    if (!role) return;

    await user.roles.remove(role);

    hasToLog && logRoleChange(guild, userId, roleId, 'removed', true);

    const memberships = ((await loadMemberships()).values()).filter((m) => {
      return !(m.userId === userId && m.roleId === roleId);
    });
    await saveMemberships(
      new Collection(memberships.map((m) => [m.userId, m])),
    );
  } catch (error) {
    console.error(`Error removing role ${roleId} from ${userId}:`, error);
    hasToLog &&
      logRoleChange(
        guild,
        userId,
        roleId,
        'removed',
        false,
        'Error removing role.',
      );
  }
}

/**
 * Checks expired roles and removes them when needed.
 */
export async function checkExpiredRoles(client: Client): Promise<void> {
  await saveMemberships(new Collection<string, Membership>());
  const memberships = await loadMemberships();
  if (!memberships.size || memberships.size <= 1) return;
  const now = Date.now();
  for (const membership of memberships.values()) {
    if (membership.expiresAt && membership.expiresAt < now) {
      const guild = client.guilds.cache.get(membership.guildId);
      if (guild) await removeRole(guild, membership.userId, membership.roleId);
    }
  }
}
