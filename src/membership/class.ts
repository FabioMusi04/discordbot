import { ChatInputCommandInteraction, GuildMember, Role, EmbedBuilder, TextChannel } from 'discord.js';
import { parseDuration } from './utils';
import config from '../config';

export class MembershipManager {
  private logChannelId: string = config.membershipsLogsChannelId;

  constructor() { }

  private async logMembershipChange(
    interaction: ChatInputCommandInteraction,
    targetUser: GuildMember,
    role: Role,
    action: 'added' | 'removed',
    duration?: string,
    success: boolean = true,
    errorMessage?: string
  ) {
    const logChannel = interaction.guild?.channels.cache.get(this.logChannelId) as TextChannel;
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

  public async assignMembership(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getMember('user') as GuildMember;
    const duration = interaction.options.getString('duration');
    const role = interaction.options.getRole('role') as Role;

    if (!targetUser || !role || !duration) {
      return interaction.reply({ content: 'Invalid user or role or duration', ephemeral: true });
    }

    if (targetUser.roles.cache.has(role.id)) {
      await this.logMembershipChange(interaction, targetUser, role, 'added', duration, false, 'User already has this role');
      return interaction.reply({ content: `${targetUser} already has the ${role.name} role.`, ephemeral: true });
    }

    if (duration && duration.toLowerCase() !== 'perm') {
      const timeMs = parseDuration(duration);
      if (!timeMs) {
        return interaction.reply({ content: 'Invalid duration format. Use h (hours), d (days), or m (minutes).', ephemeral: true });
      }
    }

    try {
      await targetUser.roles.add(role);
      await interaction.reply({ content: `${targetUser} has been given the ${role.name} role.`, ephemeral: false });
      await this.logMembershipChange(interaction, targetUser, role, 'added', duration);

      if (duration && duration.toLowerCase() !== 'perm') {
        const timeMs = parseDuration(duration);
        if (!timeMs) {
          return interaction.reply({ content: 'Invalid duration format. Use h (hours), d (days), or m (minutes).', ephemeral: true });
        }

        setTimeout(async () => {
          try {
            await targetUser.roles.remove(role);
            if (interaction.channel) {
              await interaction.followUp(`${targetUser}'s ${role.name} role has been removed.`);
              await this.logMembershipChange(interaction, targetUser, role, 'removed', undefined, true);
            }
          } catch (error) {
            await this.logMembershipChange(interaction, targetUser, role, 'removed', undefined, false, 'Failed to remove role automatically');
          }
        }, timeMs);
      } else {
        return interaction.followUp({ content: 'Invalid duration format. Use h (hours), d (days), or m (minutes).', ephemeral: true });
      }
    } catch (error) {
      await this.logMembershipChange(interaction, targetUser, role, 'added', duration, false, 'Failed to add role');
      await interaction.reply({ content: 'Failed to assign the role.', ephemeral: true });
    }
  }

  public async removeMembership(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getMember('user') as GuildMember;
    const role = interaction.options.getRole('role') as Role;

    if (!targetUser || !role) {
      return interaction.reply({ content: 'Invalid user or role.', ephemeral: true });
    }

    if (!targetUser.roles.cache.has(role.id)) {
      await this.logMembershipChange(interaction, targetUser, role, 'removed', undefined, false, "User doesn't have this role");
      return interaction.reply({ content: `${targetUser} doesn't have the ${role.name} role.`, ephemeral: true });
    }

    try {
      await targetUser.roles.remove(role);
      await interaction.reply({ content: `${role.name} role has been removed from ${targetUser}.`, ephemeral: false });
      await this.logMembershipChange(interaction, targetUser, role, 'removed');
    } catch (error) {
      await this.logMembershipChange(interaction, targetUser, role, 'removed', undefined, false, 'Failed to remove role');
      await interaction.reply({ content: 'Failed to remove the role.', ephemeral: true });
    }
  }
}