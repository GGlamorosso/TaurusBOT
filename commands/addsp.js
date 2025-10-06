import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { getUserData, saveSoon, logToChannel } from '../utils.js';

export const data = new SlashCommandBuilder()
  .setName('addsp')
  .setDescription('Ajouter des SP à un utilisateur.')
  .addUserOption(opt => opt.setName('utilisateur').setDescription('Utilisateur cible').setRequired(true))
  .addIntegerOption(opt => opt.setName('quantité').setDescription('Quantité de SP à ajouter').setRequired(true))
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles);

export async function execute(interaction, client, context) {
  const { STAFF_ROLE_ID } = context;
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const isStaff = member && STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID);
  if (!isStaff) {
    return interaction.editReply({ content: '❌ Vous n’avez pas la permission d’utiliser cette commande.' });
  }
  const target = interaction.options.getUser('utilisateur', true);
  const amount = interaction.options.getInteger('quantité', true);
  if (amount <= 0) {
    return interaction.editReply({ content: 'La quantité doit être un nombre positif.' });
  }
  const data = getUserData(target.id);
  data.sp = (data.sp ?? 0) + amount;
  saveSoon();
  await interaction.editReply({ content: `✅ **${amount} SP** ajoutés à **${target.tag}** (total: ${data.sp}).` });
  await logToChannel(client, `🔸 ${interaction.user.tag} a ajouté ${amount} SP à ${target.tag} (total ${data.sp}).`);
}


