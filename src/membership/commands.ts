import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

const addMembershipCommand = new SlashCommandBuilder()
  .setName('m-membership')
  .setDescription('Assign a user the Tester role.')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption((option) =>
    option.setName('user')
      .setDescription('The user to assign the role to')
      .setRequired(true)
  )
  .addRoleOption((option) =>
    option.setName('role')
      .setDescription('The role to assign to the user')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option.setName('duration')
      .setDescription('Duration of the membership (e.g., 1h, 2d, perm)')
      .setRequired(true)
  );

const removeMembershipCommand = new SlashCommandBuilder()
  .setName('m-unmembership')
  .setDescription('Remove a role from a user.')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption((option) =>
    option.setName('user')
      .setDescription('The user to remove the role from')
      .setRequired(true)
  )
  .addRoleOption((option) =>
    option.setName('role')
      .setDescription('The role to remove from the user')
      .setRequired(true)
  );

export const membershipCommands = [
  addMembershipCommand,
  removeMembershipCommand,
];
