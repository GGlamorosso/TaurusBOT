import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUserData, getRankNameFromLp } from '../utils.js';

export const data = new SlashCommandBuilder()
  .setName('mypoints')
  .setDescription('Afficher vos LP, SP et votre rang.');

export async function execute(interaction) {
  const data = getUserData(interaction.user.id);
  const rankName = getRankNameFromLp(data.lp ?? 0);
  const embed = new EmbedBuilder()
    .setTitle('Vos Points')
    .setDescription(`**LP :** ${data.lp ?? 0}\n**SP :** ${data.sp ?? 0}\n**Rang :** ${rankName}`)
    .setColor(0x00bfff);
  await interaction.editReply({ embeds: [embed] });
}


