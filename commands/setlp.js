import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { getUserData, saveSoon, applyRankRole, logToChannel } from '../utils.js';

export const data = new SlashCommandBuilder()
  .setName('setlp')
  .setDescription('Définir le nombre de LP d’un utilisateur.')
  .addUserOption(opt => opt.setName('utilisateur').setDescription('Utilisateur cible').setRequired(true))
  .addIntegerOption(opt => opt.setName('valeur').setDescription('Nouveau total de LP').setRequired(true))
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles);

export async function execute(interaction, client, context) {
  const { STAFF_ROLE_ID } = context;
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const isStaff = member && STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID);
  if (!isStaff) {
    return interaction.editReply({ content: '❌ Vous n’avez pas la permission d’utiliser cette commande.' });
  }
  const target = interaction.options.getUser('utilisateur', true);
  const value = interaction.options.getInteger('valeur', true);
  if (value < 0) {
    return interaction.editReply({ content: 'La valeur de LP ne peut pas être négative.' });
  }
  const data = getUserData(target.id);
  data.lp = value;
  saveSoon();
  const guildMember = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (guildMember) {
    await applyRankRole(guildMember, data.lp);
  }
  await interaction.editReply({ content: `✅ Les LP de **${target.tag}** ont été définis à **${data.lp}**.` });
  await logToChannel(client, `🪄 ${interaction.user.tag} a défini les LP de ${target.tag} à ${data.lp}.`);
}


