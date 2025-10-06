// Shared utilities: data store, helpers, embeds, publishing, buttons
import fs from 'fs';
import dotenv from 'dotenv';
import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType } from 'discord.js';

dotenv.config();

const {
  DISCORD_TOKEN,
  GUILD_ID,
  WELCOME_CHANNEL_ID,
  VALIDATION_CHANNEL_ID,
  STAFF_VALIDATION_CHANNEL_ID,
  GENERAL_VIP_CHANNEL_ID,
  ANALYSE_REQUEST_CHANNEL_ID,
  CLASSEMENT_CHANNEL_ID,
  BOT_LOGS_CHANNEL_ID,
  NONVIA_ROLE_ID,
  ROOKIE_ROLE_ID,
  STAFF_ROLE_ID,
  RANK_MEMBRE_ROLE_ID,
  RANK_CAPTAIN_ROLE_ID,
  RANK_BRASDROIT_ROLE_ID,
  RANK_PARRAIN_ROLE_ID,
  RANK_LEGENDE_ROLE_ID,
  AFFILIATE_URL
} = process.env;

export function getConfig() {
  return {
    DISCORD_TOKEN,
    GUILD_ID,
    WELCOME_CHANNEL_ID,
    VALIDATION_CHANNEL_ID,
    STAFF_VALIDATION_CHANNEL_ID,
    GENERAL_VIP_CHANNEL_ID,
    ANALYSE_REQUEST_CHANNEL_ID,
    CLASSEMENT_CHANNEL_ID,
    BOT_LOGS_CHANNEL_ID,
    NONVIA_ROLE_ID,
    ROOKIE_ROLE_ID,
    STAFF_ROLE_ID,
    RANK_MEMBRE_ROLE_ID,
    RANK_CAPTAIN_ROLE_ID,
    RANK_BRASDROIT_ROLE_ID,
    RANK_PARRAIN_ROLE_ID,
    RANK_LEGENDE_ROLE_ID,
    AFFILIATE_URL
  };
}

const DATA_FILE = './points.json';
export const DATA = {
  users: {},
  tickets: {},
  leaderboard: { channelId: null, messageId: null }
};

export function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed) {
      DATA.users = parsed.users ?? {};
      DATA.tickets = parsed.tickets ?? {};
      DATA.leaderboard = parsed.leaderboard ?? { channelId: null, messageId: null };
    }
  } catch {
    console.warn('No existing points.json found or invalid JSON. A new one will be created on save.');
  }
}

export function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(DATA, null, 2));
}

export function saveSoon() {
  clearTimeout(saveSoon.timer);
  saveSoon.timer = setTimeout(() => {
    try {
      saveData();
    } catch (e) {
      console.error('Failed to save points.json:', e);
    }
  }, 1000);
}

export function getUserData(userId) {
  if (!DATA.users[userId]) {
    DATA.users[userId] = { lp: 0, sp: 0 };
  }
  return DATA.users[userId];
}

export async function logToChannel(client, content) {
  if (!BOT_LOGS_CHANNEL_ID) return;
  try {
    const channel = await client.channels.fetch(BOT_LOGS_CHANNEL_ID).catch(() => null);
    if (channel) {
      await channel.send(content);
    }
  } catch (e) {
    console.warn('Failed to write to log channel:', e);
  }
}

export const rankThresholds = [
  { threshold: 20000, roleId: RANK_LEGENDE_ROLE_ID },
  { threshold: 10000, roleId: RANK_PARRAIN_ROLE_ID },
  { threshold: 5000, roleId: RANK_BRASDROIT_ROLE_ID },
  { threshold: 1000, roleId: RANK_CAPTAIN_ROLE_ID },
  { threshold: 100, roleId: RANK_MEMBRE_ROLE_ID },
  { threshold: 0, roleId: ROOKIE_ROLE_ID }
];

export async function applyRankRole(member, lp) {
  if (!member || !member.roles) return;
  let desiredRoleId = null;
  for (const { threshold, roleId } of rankThresholds) {
    if (lp >= threshold) {
      desiredRoleId = roleId;
      break;
    }
  }
  const allRankRoleIds = rankThresholds.map(r => r.roleId).filter(Boolean);
  const rolesToRemove = allRankRoleIds.filter(id => id && id !== desiredRoleId && member.roles.cache.has(id));
  try {
    if (rolesToRemove.length) {
      await member.roles.remove(rolesToRemove).catch(() => {});
    }
    if (desiredRoleId && !member.roles.cache.has(desiredRoleId)) {
      await member.roles.add(desiredRoleId).catch(() => {});
    }
  } catch (e) {
    console.warn('Failed to update rank roles:', e);
  }
}

export async function buildLeaderboardEmbed(client) {
  const entries = Object.entries(DATA.users).map(([uid, val]) => ({ uid, lp: val.lp ?? 0 }));
  entries.sort((a, b) => b.lp - a.lp);
  const top = entries.slice(0, 10);
  let description = '';
  if (top.length === 0) {
    description = '_Aucune donnée disponible._';
  } else {
    const lines = [];
    for (let i = 0; i < top.length; i++) {
      const entry = top[i];
      let tag = `<@${entry.uid}>`;
      try {
        const user = await client.users.fetch(entry.uid);
        tag = user.tag;
      } catch {}
      lines.push(`**#${i + 1}** — ${tag} : **${entry.lp.toLocaleString('fr-FR')} LP**`);
    }
    description = lines.join('\n');
  }
  const embed = new EmbedBuilder()
    .setTitle('🏆 Leaderboard — Top 10 LP')
    .setDescription(description)
    .setTimestamp(new Date());
  return embed;
}

export async function publishLeaderboard(client) {
  if (!CLASSEMENT_CHANNEL_ID) return;
  const channel = await client.channels.fetch(CLASSEMENT_CHANNEL_ID).catch(() => null);
  if (!channel) return;
  const embed = await buildLeaderboardEmbed(client);
  try {
    const stored = DATA.leaderboard ?? { channelId: null, messageId: null };
    if (stored.channelId === CLASSEMENT_CHANNEL_ID && stored.messageId) {
      const message = await channel.messages.fetch(stored.messageId).catch(() => null);
      if (message) {
        await message.edit({ embeds: [embed] });
        return;
      }
    }
    const sent = await channel.send({ embeds: [embed] });
    DATA.leaderboard = { channelId: CLASSEMENT_CHANNEL_ID, messageId: sent.id };
    saveSoon();
  } catch (e) {
    console.warn('Failed to publish leaderboard:', e);
  }
}

export async function sendAnalyseRequestButton(client) {
  if (!ANALYSE_REQUEST_CHANNEL_ID) return;
  try {
    const channel = await client.channels.fetch(ANALYSE_REQUEST_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    const button = new ButtonBuilder()
      .setCustomId('analysis_request')
      .setLabel('📌 Demander une analyse')
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(button);
    await channel.send({
      content: 'Cliquez sur le bouton ci-dessous pour ouvrir un ticket d’analyse privé avec le staff.',
      components: [row]
    });
  } catch (e) {
    console.warn('Failed to send analysis request button:', e);
  }
}

export async function sendWelcomeButtons(client) {
  if (!WELCOME_CHANNEL_ID) return;
  try {
    const channel = await client.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    const embed = new EmbedBuilder()
      .setTitle('Bienvenue dans la Betting School 👋')
      .setDescription(
        'Ici, tu profites de :\n' +
        '• Analyses & conseils privés\n' +
        '• Outils et salons exclusifs\n' +
        '• Récompenses grâce à tes LP (points)\n\n' +
        'Bonus de bienvenue (1er dépôt) :\n' +
        '• 50% de freebets offerts jusqu’à 200€\n' +
        '• Exemple : tu déposes 200€ → 100€ de freebets immédiatement + 200 LP\n\n' +
        'Notre partenaire Celsius nous permet d’offrir les meilleurs avantages aux membres.\n' +
        'Comment ça marche ?\n\n' +
        'Dépose via le bouton Lien affilié\n' +
        'Clique J’ai déposé\n' +
        'Plus tu déposes, plus tu gagnes de LP → bonus exclusifs\n' +
        'Dès 100 LP : on t’envoie un maillot de foot exclusif.\n\n' +
        'Besoin d’aide ? Clique Aide.'
      )
      .setColor(14290703);
    const affiliateBtn = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel('🔗 Lien affilié Celsius')
      .setURL(AFFILIATE_URL);
    const depositButton = new ButtonBuilder()
      .setCustomId('start_validation')
      .setLabel('✅ J’ai déposé')
      .setStyle(ButtonStyle.Success);
    const helpButton = new ButtonBuilder()
      .setCustomId('need_help')
      .setLabel('❓ Aide')
      .setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(affiliateBtn, depositButton, helpButton);
    await channel.send({
      embeds: [embed],
      components: [row]
    });
  } catch (e) {
    console.warn('Failed to send welcome buttons:', e);
  }
}

// Send the requested welcome embed with action buttons when a member joins
export async function sendMemberWelcome(client, member) {
  if (!WELCOME_CHANNEL_ID) return;
  try {
    const channel = await client.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    const embed = new EmbedBuilder()
      .setTitle('Bienvenue dans la Betting School 👋')
      .setDescription(
        'Ici, tu profites de :\n' +
        '• Analyses & conseils privés\n' +
        '• Outils et salons exclusifs\n' +
        '• Récompenses grâce à tes LP (points)\n\n' +
        'Bonus de bienvenue (1er dépôt) :\n' +
        '• 50% de freebets offerts jusqu’à 200€\n' +
        '• Exemple : tu déposes 200€ → 100€ de freebets immédiatement + 200 LP\n\n' +
        'Notre partenaire Celsius nous permet d’offrir les meilleurs avantages aux membres.\n' +
        'Comment ça marche ?\n\n' +
        'Dépose via le bouton Lien affilié\n' +
        'Clique J’ai déposé\n' +
        'Plus tu déposes, plus tu gagnes de LP → bonus exclusifs\n' +
        'Dès 100 LP : on t’envoie un maillot de foot exclusif.\n\n' +
        'Besoin d’aide ? Clique Aide.'
      )
      .setColor(14290703);
    const affiliateBtn = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel('🔗 Lien affilié Celsius')
      .setURL(AFFILIATE_URL);
    const depositButton = new ButtonBuilder()
      .setCustomId('start_validation')
      .setLabel('✅ J’ai déposé')
      .setStyle(ButtonStyle.Success);
    const helpButton = new ButtonBuilder()
      .setCustomId('need_help')
      .setLabel('❓ Aide')
      .setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(affiliateBtn, depositButton, helpButton);
    await channel.send({
      content: member ? `<@${member.id}>` : undefined,
      embeds: [embed],
      components: [row],
      allowedMentions: member ? { users: [member.id] } : undefined
    });
  } catch (e) {
    console.warn('Failed to send member welcome embed:', e);
  }
}

// Helper to compute rank name (used by mypoints)
export function getRankNameFromLp(lp) {
  let currentRank = 'Rookie';
  for (const { threshold, roleId } of rankThresholds) {
    if ((lp ?? 0) >= threshold) {
      if (roleId === RANK_LEGENDE_ROLE_ID) currentRank = 'Légende';
      else if (roleId === RANK_PARRAIN_ROLE_ID) currentRank = 'Parrain';
      else if (roleId === RANK_BRASDROIT_ROLE_ID) currentRank = 'Bras Droit';
      else if (roleId === RANK_CAPTAIN_ROLE_ID) currentRank = 'Captain';
      else if (roleId === RANK_MEMBRE_ROLE_ID) currentRank = 'Membre';
      else currentRank = 'Rookie';
      break;
    }
  }
  return currentRank;
}

export { ChannelType };


