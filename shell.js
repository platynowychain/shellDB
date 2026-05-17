require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const PREFIX = 'sh ';
const ADMIN_ROLE_ID = '1504782202716553266';

const app = express();
app.get('/', (req, res) => {
    res.send('Bot is online and active!');
});
app.listen(process.env.PORT || 3000, () => {
    console.log(`Web server listening on port ${process.env.PORT || 3000} for uptime pings.`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

client.once('ready', async () => {
    console.log(`authenticated as ${client.user.tag}`);

    client.user.setPresence({
        status: 'dnd',
        activities: [{
            name: 'rising to the top',
            type: 3,
        }],
    });

    const commands = [
        {
            name: 'help',
            description: 'displays help data',
        },
        {
            name: 'say',
            description: 'make the bot say something',
            options: [
                {
                    type: 3,
                    name: 'text',
                    description: 'the text to say',
                    required: true,
                },
            ],
        },
        {
            name: 'shutdown',
            description: 'shuts down the bot (shell administrator only)',
        },
        {
            name: 'ban',
            description: 'bans a user (shell administrator only)',
            options: [
                {
                    type: 6,
                    name: 'user',
                    description: 'the user to ban',
                    required: true,
                },
                {
                    type: 3,
                    name: 'reason',
                    description: 'reason for ban',
                    required: false,
                },
            ],
        },
        {
            name: 'unban',
            description: 'unbans a user by id (shell administrator only)',
            options: [
                {
                    type: 3,
                    name: 'user_id',
                    description: 'the id of the user to unban',
                    required: true,
                },
                {
                    type: 3,
                    name: 'reason',
                    description: 'reason for unban',
                    required: false,
                },
            ],
        },
        {
            name: 'softban',
            description: 'bans and immediately unbans to clear messages (shell administrator only)',
            options: [
                {
                    type: 6,
                    name: 'user',
                    description: 'the user to softban',
                    required: true,
                },
                {
                    type: 3,
                    name: 'reason',
                    description: 'reason for softban',
                    required: false,
                },
            ],
        },
        {
            name: 'kick',
            description: 'kicks a user (shell administrator only)',
            options: [
                {
                    type: 6,
                    name: 'user',
                    description: 'the user to kick',
                    required: true,
                },
                {
                    type: 3,
                    name: 'reason',
                    description: 'reason for kick',
                    required: false,
                },
            ],
        },
        {
            name: 'mute',
            description: 'timeouts a user for a set number of minutes (shell administrator only)',
            options: [
                {
                    type: 6,
                    name: 'user',
                    description: 'the user to mute',
                    required: true,
                },
                {
                    type: 4,
                    name: 'minutes',
                    description: 'duration in minutes',
                    required: true,
                },
                {
                    type: 3,
                    name: 'reason',
                    description: 'reason for mute',
                    required: false,
                },
            ],
        },
        {
            name: 'unmute',
            description: 'removes a timeout from a user (shell administrator only)',
            options: [
                {
                    type: 6,
                    name: 'user',
                    description: 'the user to unmute',
                    required: true,
                },
                {
                    type: 3,
                    name: 'reason',
                    description: 'reason for unmute',
                    required: false,
                },
            ],
        },
    ];

    await client.application.commands.set(commands);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'help') {
        await interaction.reply(
            '**prefix:** `sh`\n' +
            '**commands:**\n' +
            '`help` - displays help data\n' +
            '`say` - makes the bot say something\n' +
            '`shutdown` - shuts down the bot\n' +
            '`ban` - bans a user\n' +
            '`unban` - unbans a user by id\n' +
            '`softban` - bans then unbans to clear messages\n' +
            '`kick` - kicks a user\n' +
            '`mute` - timeouts a user\n' +
            '`unmute` - removes timeout'
        );
    }

    if (interaction.commandName === 'say') {
        const text = interaction.options.getString('text');
        await interaction.reply(text);
    }

    if (interaction.commandName === 'shutdown') {
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return interaction.reply({
                content: 'you do not have the shell administrator role.',
                ephemeral: true
            });
        }
        await interaction.reply('shutting down...');
        await client.destroy();
        process.exit(0);
    }

    if (interaction.commandName === 'ban') {
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return interaction.reply({ content: 'you do not have the shell administrator role.', ephemeral: true });
        }
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'no reason provided';
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) {
            return interaction.reply({ content: 'user not found in this server.', ephemeral: true });
        }
        if (!member.bannable) {
            return interaction.reply({ content: 'cannot ban that user. check role hierarchy and permissions.', ephemeral: true });
        }
        await member.ban({ reason: reason });
        await interaction.reply(`banned ${user.tag} (${user.id}). reason: ${reason}`);
    }

    if (interaction.commandName === 'unban') {
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return interaction.reply({ content: 'you do not have the shell administrator role.', ephemeral: true });
        }
        const userId = interaction.options.getString('user_id', true);
        const reason = interaction.options.getString('reason') || 'no reason provided';
        try {
            const ban = await interaction.guild.bans.fetch(userId);
            if (!ban) {
                return interaction.reply({ content: 'that user is not banned.', ephemeral: true });
            }
            await interaction.guild.members.unban(userId, reason);
            await interaction.reply(`unbanned ${ban.user.tag} (${userId}). reason: ${reason}`);
        } catch (err) {
            return interaction.reply({ content: 'failed to unban. check the user id and permissions.', ephemeral: true });
        }
    }

    if (interaction.commandName === 'softban') {
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return interaction.reply({ content: 'you do not have the shell administrator role.', ephemeral: true });
        }
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'no reason provided';
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) {
            return interaction.reply({ content: 'user not found in this server.', ephemeral: true });
        }
        if (!member.bannable) {
            return interaction.reply({ content: 'cannot softban that user. check role hierarchy and permissions.', ephemeral: true });
        }
        await member.ban({ reason: reason, deleteMessageDays: 7 });
        await interaction.guild.members.unban(user.id, 'softban clear messages');
        await interaction.reply(`softbanned ${user.tag} (${user.id}). messages cleared. reason: ${reason}`);
    }

    if (interaction.commandName === 'kick') {
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return interaction.reply({ content: 'you do not have the shell administrator role.', ephemeral: true });
        }
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'no reason provided';
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) {
            return interaction.reply({ content: 'user not found in this server.', ephemeral: true });
        }
        if (!member.kickable) {
            return interaction.reply({ content: 'cannot kick that user. check role hierarchy and permissions.', ephemeral: true });
        }
        await member.kick(reason);
        await interaction.reply(`kicked ${user.tag} (${user.id}). reason: ${reason}`);
    }

    if (interaction.commandName === 'mute') {
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return interaction.reply({ content: 'you do not have the shell administrator role.', ephemeral: true });
        }
        const user = interaction.options.getUser('user', true);
        const minutes = interaction.options.getInteger('minutes', true);
        const reason = interaction.options.getString('reason') || 'no reason provided';
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) {
            return interaction.reply({ content: 'user not found in this server.', ephemeral: true });
        }
        if (!member.moderatable) {
            return interaction.reply({ content: 'cannot mute that user. check role hierarchy and permissions.', ephemeral: true });
        }
        const durationMs = minutes * 60 * 1000;
        await member.timeout(durationMs, reason);
        await interaction.reply(`muted ${user.tag} for ${minutes} minute(s). reason: ${reason}`);
    }

    if (interaction.commandName === 'unmute') {
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return interaction.reply({ content: 'you do not have the shell administrator role.', ephemeral: true });
        }
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'no reason provided';
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) {
            return interaction.reply({ content: 'user not found in this server.', ephemeral: true });
        }
        if (!member.moderatable) {
            return interaction.reply({ content: 'cannot unmute that user. check role hierarchy and permissions.', ephemeral: true });
        }
        await member.timeout(null, reason);
        await interaction.reply(`unmuted ${user.tag}. reason: ${reason}`);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'say') {
        const text = message.content.slice(PREFIX.length).trim().slice('say'.length).trim();
        if (!text) return message.reply('**usage:** sh say <input>');
        await message.channel.send(text);
    }

    if (command === 'help') {
        await message.reply(
            '**prefix:** `sh`\n' +
            '**commands:**\n' +
            '`help` - displays help data\n' +
            '`say` - makes the bot say something\n' +
            '`shutdown` - shuts down the bot\n' +
            '`ban` - bans a user\n' +
            '`unban` - unbans a user by id\n' +
            '`softban` - bans then unbans to clear messages\n' +
            '`kick` - kicks a user\n' +
            '`mute` - timeouts a user\n' +
            '`unmute` - removes timeout'
        );
    }

    if (command === 'shutdown') {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return message.reply('you do not have the shell administrator role.');
        }
        await message.channel.send('shutting down...');
        await client.destroy();
        process.exit(0);
    }

    if (command === 'ban') {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return message.reply('you do not have the shell administrator role.');
        }
        const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('**usage:** sh ban <@user|id> [reason]');
        const reason = args.slice(1).join(' ') || 'no reason provided';
        if (!target.bannable) return message.reply('cannot ban that user. check role hierarchy and permissions.');
        await target.ban({ reason: reason });
        await message.channel.send(`banned ${target.user.tag} (${target.id}). reason: ${reason}`);
    }

    if (command === 'unban') {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return message.reply('you do not have the shell administrator role.');
        }
        const userId = args[0];
        if (!userId) return message.reply('**usage:** sh unban <user_id> [reason]');
        const reason = args.slice(1).join(' ') || 'no reason provided';
        try {
            const ban = await message.guild.bans.fetch(userId);
            if (!ban) return message.reply('that user is not banned.');
            await message.guild.members.unban(userId, reason);
            await message.channel.send(`unbanned ${ban.user.tag} (${userId}). reason: ${reason}`);
        } catch (err) {
            return message.reply('failed to unban. check the user id and permissions.');
        }
    }

    if (command === 'softban') {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return message.reply('you do not have the shell administrator role.');
        }
        const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('**usage:** sh softban <@user|id> [reason]');
        const reason = args.slice(1).join(' ') || 'no reason provided';
        if (!target.bannable) return message.reply('cannot softban that user. check role hierarchy and permissions.');
        await target.ban({ reason: reason, deleteMessageDays: 7 });
        await message.guild.members.unban(target.id, 'softban clear messages');
        await message.channel.send(`softbanned ${target.user.tag} (${target.id}). messages cleared. reason: ${reason}`);
    }

    if (command === 'kick') {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return message.reply('you do not have the shell administrator role.');
        }
        const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('**usage:** sh kick <@user|id> [reason]');
        const reason = args.slice(1).join(' ') || 'no reason provided';
        if (!target.kickable) return message.reply('cannot kick that user. check role hierarchy and permissions.');
        await target.kick(reason);
        await message.channel.send(`kicked ${target.user.tag} (${target.id}). reason: ${reason}`);
    }

    if (command === 'mute') {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return message.reply('you do not have the shell administrator role.');
        }
        const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('**usage:** sh mute <@user|id> <minutes> [reason]');
        const minutes = parseInt(args[1]);
        if (isNaN(minutes) || minutes <= 0) return message.reply('**usage:** sh mute <@user|id> <minutes> [reason]');
        const reason = args.slice(2).join(' ') || 'no reason provided';
        if (!target.moderatable) return message.reply('cannot mute that user. check role hierarchy and permissions.');
        await target.timeout(minutes * 60 * 1000, reason);
        await message.channel.send(`muted ${target.user.tag} for ${minutes} minute(s). reason: ${reason}`);
    }

    if (command === 'unmute') {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return message.reply('you do not have the shell administrator role.');
        }
        const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('**usage:** sh unmute <@user|id> [reason]');
        const reason = args.slice(1).join(' ') || 'no reason provided';
        if (!target.moderatable) return message.reply('cannot unmute that user. check role hierarchy and permissions.');
        await target.timeout(null, reason);
        await message.channel.send(`unmuted ${target.user.tag}. reason: ${reason}`);
    }
});

client.login(process.env.TOKEN);