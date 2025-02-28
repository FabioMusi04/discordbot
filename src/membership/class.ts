import { ChatInputCommandInteraction, GuildMember, Role, Client, EmbedBuilder, TextChannel } from 'discord.js';
import { loadMemberships, saveMemberships, parseDuration, removeRole } from './utils/index.ts';

import config from '../config.ts';

export class MembershipManager {
  constructor(private client: Client) {
    this.setupExpiredRoleChecks();
  }

  /**
   * Schedules role removals on bot startup.
   */
  private setupExpiredRoleChecks() {
    const memberships = loadMemberships();
    const now = Date.now();

    memberships.forEach((membership) => {
      if (membership.expiresAt && membership.expiresAt > now) {
        const guild = this.client.guilds.cache.get(membership.guildId);
        if (!guild) return;

        const delay = membership.expiresAt - now;
        console.log(`Scheduling role removal for ${membership.userId} in ${delay}ms`);

        setTimeout(() => removeRole(guild, membership.userId, membership.roleId), delay);
      }
    });
  }

  /**
   * Assigns a role to a user with an optional expiration.
   */
  public async assignMembership(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getMember('user') as GuildMember;
    const role = interaction.options.getRole('role') as Role;
    const duration = interaction.options.getString('duration');

    if (!targetUser || !role || !duration) {
      return interaction.reply({ content: 'Invalid user, role, or duration.', ephemeral: true });
    }

    if (targetUser.roles.cache.has(role.id)) {
      return interaction.reply({ content: `${targetUser} already has this role.`, ephemeral: true });
    }

    try {
      await targetUser.roles.add(role);
      this.logMembershipChange(interaction, targetUser, role, 'added', duration, true);
      interaction.reply({ content: 'Role assigned successfully.', ephemeral: true });

      if (duration.toLowerCase() !== 'perm') {
        const timeMs = parseDuration(duration);
        if (!timeMs) return interaction.reply({ content: 'Invalid duration format.', ephemeral: true });

        const expiresAt = Date.now() + timeMs;
        const memberships = loadMemberships();
        memberships.push({ userId: targetUser.id, guildId: targetUser.guild.id, expiresAt, roleId: role.id });
        saveMemberships(memberships);

        console.log(`Scheduling role removal for ${targetUser.id} in ${timeMs}ms`);
        setTimeout(() => removeRole(interaction.guild!, targetUser.id, role.id), timeMs);
      }
    } catch (error) {
      this.logMembershipChange(interaction, targetUser, role, 'added', duration, false, 'Failed to assign the role.');
      await interaction.reply({ content: 'Failed to assign the role.', ephemeral: true });
    }
  }

  /**
   * Manually removes a role from a user.
   */
  public async removeMembership(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getMember('user') as GuildMember;
    const role = interaction.options.getRole('role') as Role;

    if (!targetUser || !role) {
      return interaction.reply({ content: 'Invalid user or role.', ephemeral: true });
    }

    if (!targetUser.roles.cache.has(role.id)) {
      return interaction.reply({ content: `${targetUser} does not have this role.`, ephemeral: true });
    }

    await removeRole(interaction.guild!, targetUser.id, role.id, false);
    this.logMembershipChange(interaction, targetUser, role, 'removed');

    interaction.reply({ content: 'Role removed successfully.', ephemeral: true });
  }


  /**
   * Logs a membership change to a channel.
   */
  private async logMembershipChange(
    interaction: ChatInputCommandInteraction,
    targetUser: GuildMember,
    role: Role,
    action: 'added' | 'removed',
    duration?: string,
    success: boolean = true,
    errorMessage?: string
  ) {
    const logChannel = interaction.guild?.channels.cache.get(config.membershipsLogsChannelId) as TextChannel;
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(success ? (action === 'added' ? '#00ff00' : '#ff0000') : '#ff6b6b')
      .setTitle(`Membership Role ${action.charAt(0).toUpperCase() + action.slice(1)}`)
      .setThumbnail(targetUser.user.displayAvatarURL())
      .addFields(
        { name: 'User', value: `${targetUser} (${targetUser.user.tag})`, inline: true },
        { name: 'Role', value: role.name, inline: true },
        { name: 'Action By', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
        { name: 'Status', value: success ? 'Success' : 'Failed', inline: true }
      )
      .setTimestamp();

    if (duration && action === 'added') {
      embed.addFields({ name: 'Duration', value: duration === 'perm' ? 'Permanent' : duration, inline: true });
    }

    if (!success && errorMessage) {
      embed.addFields({ name: 'Error', value: errorMessage, inline: false });
    }

    await logChannel.send({ embeds: [embed] });
  }
}
