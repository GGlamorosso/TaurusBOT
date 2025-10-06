import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { buildLeaderboardEmbed, publishLeaderboard, logToChannel } from '../utils.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Afficher le classement des 10 meilleurs LP.');

export async function execute(interaction, client) {
  const embed = await buildLeaderboardEmbed(client);
  await interaction.editReply({ embeds: [embed] });
}

export const publishData = new SlashCommandBuilder()
  .setName('publishleaderboard')
  .setDescription('Publier ou mettre à jour le classement dans le salon dédié.')
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles);

export async function executePublish(interaction, client) {
  await publishLeaderboard(client);
  await interaction.editReply({ content: '✅ Classement publié.' });
  await logToChannel(client, `📣 ${interaction.user.tag} a mis à jour le classement.`);
}


