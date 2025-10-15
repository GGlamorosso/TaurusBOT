# Betting Bot - Système de Tickets

## Configuration

Pour utiliser le système de tickets de support, ajoutez la variable d'environnement suivante à votre fichier `.env` :

```
SUPPORT_CHANNEL_ID=1426262187055517748
```

## Fonctionnalités

### Système de Tickets de Support

- **Message automatique** : Le bot envoie automatiquement un message "Besoin d'aide ? Ouvre un ticket en dessous" dans le salon support
- **Bouton de ticket** : Un bouton "🎫 Ouvrir un ticket" permet aux membres d'ouvrir un ticket
- **Thread privé** : Chaque ticket crée un thread privé avec :
  - Le membre qui a ouvert le ticket
  - Tous les membres du staff (rôle STAFF_ROLE_ID)
  - Message d'accueil automatique
  - Archivage automatique après 7 jours d'inactivité

### Utilisation

1. Les membres cliquent sur le bouton "🎫 Ouvrir un ticket" dans le salon support
2. Un thread privé est créé automatiquement
3. Le membre peut décrire son problème
4. Le staff peut répondre dans le thread privé
5. Le ticket s'archive automatiquement après 7 jours d'inactivité

## Variables d'environnement requises

```
DISCORD_TOKEN=your_discord_bot_token
GUILD_ID=your_guild_id
SUPPORT_CHANNEL_ID=1426262187055517748
STAFF_ROLE_ID=your_staff_role_id
BOT_LOGS_CHANNEL_ID=your_bot_logs_channel_id
```

## Permissions requises

Le bot doit avoir les permissions suivantes :
- Créer des threads privés
- Gérer les membres des threads
- Envoyer des messages
- Lire l'historique des messages
