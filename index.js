// Betting School Bot - Automated management and LP/SP tracking
import { Client, GatewayIntentBits, Partials, REST, Routes, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ChannelType, Events } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  getConfig,
  loadData,
  saveSoon,
  getUserData,
  logToChannel,
  applyRankRole,
  applyRankEmojiToNickname,
  buildLeaderboardEmbed,
  publishLeaderboard,
  sendAnalyseRequestButton,
  sendWelcomeButtons,
  sendMemberWelcome,
  DATA,
  rankThresholds
} from './utils.js';

// Load environment variables from .env file
dotenv.config();

// pull config
const config = getConfig();
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
} = config;

/**
 * Register slash commands on the guild. Commands are registered each time
 * the bot starts to ensure updates propagate quickly.
 * @param {Client} client
 */
async function registerSlashCommands(client, commandsCollection) {
  try {
    const json = [];
    for (const [, cmd] of commandsCollection) {
      if (cmd.data) json.push(cmd.data.toJSON());
    }
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(client.application.id, GUILD_ID),
      { body: json }
    );
    console.log('✅ Slash commands registered.');
  } catch (e) {
    console.error('Failed to register slash commands:', e);
  }
}

// Create the Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

/**
 * Handler executed when the client is ready.
 */
client.once(Events.ClientReady, async () => {
  console.log(`✅ Connecté en ${client.user.tag}`);
  // Load persisted data
  loadData();
  // Dynamically load command modules
  const commands = new Map();
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const commandsDir = path.join(__dirname, 'commands');
    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const mod = await import(path.join(commandsDir, file));
      const name = mod.data?.name ?? file.replace(/\.js$/, '');
      if (mod.data) commands.set(mod.data.name, mod);
      if (mod.publishData) commands.set(mod.publishData.name, { data: mod.publishData, execute: mod.executePublish });
    }
    client.commands = commands;
  } catch (e) {
    console.error('Failed to load commands:', e);
  }
  // Register slash commands
  await registerSlashCommands(client, client.commands ?? new Map());
  // Send welcome and analysis buttons
  await sendWelcomeButtons(client);
  await sendAnalyseRequestButton(client);
});

/**
 * When a new member joins the guild, assign the Non-VIA role automatically.
 */
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    if (NONVIA_ROLE_ID && !member.roles.cache.has(NONVIA_ROLE_ID)) {
      await member.roles.add(NONVIA_ROLE_ID).catch(() => {});
    }
    // Create user entry in points data
    getUserData(member.id);
    saveSoon();
    // Send welcome embed with action buttons in the welcome channel
    await sendMemberWelcome(member.client, member);
    // Ensure nickname emoji is applied (likely Rookie)
    await applyRankEmojiToNickname(member);
  } catch (e) {
    console.warn('Failed to handle member join:', e);
  }
});

/**
 * Main interaction handler: buttons, modals and slash commands are processed here.
 */
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;
    // Defer the reply as soon as possible to avoid unknown interaction errors
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    try {
      const cmd = client.commands?.get(commandName);
      if (!cmd || !cmd.execute) return interaction.editReply({ content: 'Commande non reconnue.' });
      const context = { STAFF_ROLE_ID };
      await cmd.execute(interaction, client, context);
    } catch (e) {
      console.error('Error handling slash command:', e);
      await interaction.editReply({ content: '❌ Une erreur est survenue lors du traitement de la commande.' });
    }
  } else if (interaction.isButton()) {
    // Handle buttons: validation start, help, analysis request, accept/refuse validation
    const customId = interaction.customId;
    try {
      // 'start_validation' opens a modal for deposit verification.
      // Do NOT defer before showing a modal, otherwise the interaction is already acknowledged
      // and showModal will throw InteractionAlreadyReplied.
      if (customId === 'start_validation') {
        const modal = new ModalBuilder()
          .setCustomId('validation_modal')
          .setTitle('Demande d\'accès VIP');
        const field1 = new TextInputBuilder()
          .setCustomId('celsius')
          .setLabel('Votre pseudo Celsius')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        const field2 = new TextInputBuilder()
          .setCustomId('sponsor')
          .setLabel('Parrain (si vous en avez un)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);
        const field3 = new TextInputBuilder()
          .setCustomId('email')
          .setLabel('Votre adresse email')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('exemple@email.com');
        const row1 = new ActionRowBuilder().addComponents(field1);
        const row2 = new ActionRowBuilder().addComponents(field2);
        const row3 = new ActionRowBuilder().addComponents(field3);
        modal.addComponents(row1, row2, row3);
        await interaction.showModal(modal);
        return;
      }
      // For other buttons, defer the update to prevent the "Unknown interaction" error
      await interaction.deferUpdate().catch(() => {});
      // 'need_help' simply responds with a hint message
      if (customId === 'need_help') {
        await interaction.followUp({ content: 'Pour toute question, ouvrez un ticket dans le salon **#🙋-support** afin que notre staff puisse vous aider.', flags: 64 });
        return;
      }
      // 'analysis_request' creates a private thread for match analysis
      if (customId === 'analysis_request') {
        // Create private thread
        const channel = interaction.channel;
        if (!channel || channel.type !== ChannelType.GuildText) {
          return;
        }
        const thread = await channel.threads.create({
          name: `ticket-${interaction.user.username}-${Date.now()}`,
          autoArchiveDuration: 10080,
          type: ChannelType.PrivateThread,
          reason: 'Ticket d’analyse demandé'
        }).catch(() => null);
        if (!thread) {
          await interaction.followUp({ content: 'Impossible de créer le ticket. Vérifiez mes permissions.', flags: 64 });
          return;
        }
        // Add the requesting user
        await thread.members.add(interaction.user.id).catch(() => {});
        // Add all staff members to the thread
        try {
          const staffRole = interaction.guild.roles.cache.get(STAFF_ROLE_ID);
          if (staffRole) {
            for (const [id] of staffRole.members) {
              await thread.members.add(id).catch(() => {});
            }
          }
        } catch {
          // ignore
        }
        await thread.send({ content: `👋 <@${interaction.user.id}> ticket  d’analyse ouvert\nMerci de préciser ta requête\nUn membre du staff te répondra sous peu.\n(Le ticket s’archive automatiquement après 7 jours d’inactivité)`, allowedMentions: { users: [interaction.user.id] } });
        await interaction.followUp({ content: `🎫 Votre ticket a été créé : <#${thread.id}>`, flags: 64 });
        await logToChannel(client, `🎫 Ticket d’analyse créé par ${interaction.user.tag} (#${thread.id}).`);
        return;
      }
      // Buttons prefixed with "validate_" come from staff validation embeds
      if (customId.startsWith('validate_')) {
        // Format: validate_approve_userId or validate_reject_userId
        const parts = customId.split('_');
        const action = parts[1];
        const userId = parts[2];
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        const msg = interaction.message;
        if (!member || !msg) return;
        if (action === 'approve') {
          // Remove Non-VIA and add Rookie
          try {
            if (NONVIA_ROLE_ID && member.roles.cache.has(NONVIA_ROLE_ID)) {
              await member.roles.remove(NONVIA_ROLE_ID).catch(() => {});
            }
            if (ROOKIE_ROLE_ID && !member.roles.cache.has(ROOKIE_ROLE_ID)) {
              await member.roles.add(ROOKIE_ROLE_ID).catch(() => {});
            }
            // Apply emoji to nickname after role update
            await applyRankEmojiToNickname(member);
            // Initialize user data
            getUserData(member.id);
            saveSoon();
            // Update embed to show approved status
            const embed = EmbedBuilder.from(msg.embeds[0])
              .setColor(0x00ff00)
              .addFields({ name: 'Statut', value: '✅ Approuvé' });
            await msg.edit({ embeds: [embed], components: [] });
            // Welcome the user in the general VIP channel
            if (GENERAL_VIP_CHANNEL_ID) {
              const general = await client.channels.fetch(GENERAL_VIP_CHANNEL_ID).catch(() => null);
              if (general) {
                await general.send({ content: `🎉 Bienvenue <@${member.id}> ! Votre accès VIP a été approuvé.`, allowedMentions: { users: [member.id] } });
              }
            }
            await logToChannel(client, `✅ ${interaction.user.tag} a approuvé la demande VIP de ${member.user.tag}.`);
          } catch (e) {
            console.error('Validation approval error:', e);
          }
        } else if (action === 'reject') {
          try {
            const embed = EmbedBuilder.from(msg.embeds[0])
              .setColor(0xff0000)
              .addFields({ name: 'Statut', value: '❌ Refusé' });
            await msg.edit({ embeds: [embed], components: [] });
            await logToChannel(client, `❌ ${interaction.user.tag} a refusé la demande VIP de ${member.user.tag}.`);
          } catch (e) {
            console.error('Validation rejection error:', e);
          }
        }
        return;
      }
    } catch (e) {
      console.error('Error handling button interaction:', e);
    }
  } else if (interaction.isModalSubmit()) {
    // Handle submission of the validation modal
    if (interaction.customId === 'validation_modal') {
      try {
        // Defer reply to avoid unknown interaction; set to be hidden
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        const celsius = interaction.fields.getTextInputValue('celsius');
        const sponsor = interaction.fields.getTextInputValue('sponsor');
        const email = interaction.fields.getTextInputValue('email');
        // Build embed for staff validation
        const embed = new EmbedBuilder()
          .setTitle('Nouvelle demande VIP')
          .setColor(0x00bfff)
          .addFields(
            { name: 'Utilisateur', value: `<@${interaction.user.id}> (${interaction.user.tag})` },
            { name: 'Pseudo Celsius', value: celsius },
            { name: 'Parrain', value: sponsor && sponsor.trim().length > 0 ? sponsor : 'Aucun' },
            { name: 'Adresse email', value: email }
          )
          .setTimestamp(new Date());
        // Create action buttons for staff
        const approveBtn = new ButtonBuilder()
          .setCustomId(`validate_approve_${interaction.user.id}`)
          .setLabel('Approuver')
          .setStyle(ButtonStyle.Success);
        const rejectBtn = new ButtonBuilder()
          .setCustomId(`validate_reject_${interaction.user.id}`)
          .setLabel('Refuser')
          .setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(approveBtn, rejectBtn);
        const staffChannel = STAFF_VALIDATION_CHANNEL_ID
          ? await interaction.guild.channels.fetch(STAFF_VALIDATION_CHANNEL_ID).catch(() => null)
          : null;
        if (staffChannel) {
          await staffChannel.send({ embeds: [embed], components: [row] });
        }
        await interaction.editReply({ content: '✅ Votre demande a été soumise au staff. Vous recevrez une réponse sous peu.', flags: 64 });
        await logToChannel(client, `📥 Nouvelle demande VIP soumise par ${interaction.user.tag}.`);
      } catch (e) {
        console.error('Error handling validation modal submission:', e);
        await interaction.editReply({ content: '❌ Une erreur est survenue lors de l’envoi de votre demande.', flags: 64 });
      }
    }
  }
});

// When a member's roles change, re-apply the rank emoji on nickname
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  try {
    // Only act if roles changed
    if (oldMember.roles.cache.size !== newMember.roles.cache.size || !oldMember.roles.cache.equals(newMember.roles.cache)) {
      await applyRankEmojiToNickname(newMember);
    }
  } catch {}
});

// Log the bot in
client.login(DISCORD_TOKEN);
