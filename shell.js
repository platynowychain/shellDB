require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const os = require('os');

const PREFIX = '$ ';
const ADMIN_ROLE_ID = '1504782202716553266';
let botStartTime = Date.now();

// In-memory storage for user notes, warns, and cooldowns
const userNotes = new Map(); // guildId -> Map(userId -> [{note, author, timestamp}])
const userWarns = new Map(); // guildId -> Map(userId -> [{reason, author, timestamp}])
const channelCooldowns = new Map(); // channelId -> { duration: ms, lastMessage: timestamp }

const app = express();
app.get('/', (req, res) => {
    res.send('bot is online and active!');
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
            name: 'stats',
            description: 'displays bot statistics',
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
            description: 'bans a user',
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
            description: 'unbans a user by id',
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
            description: 'bans and immediately unbans to clear messages',
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
            description: 'kicks a user',
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
            description: 'timeouts a user for a set number of minutes',
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
            description: 'removes a timeout from a user',
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
        // NEW COMMANDS
        {
            name: 'role',
            description: 'add or remove a role from a user',
            options: [
                {
                    type: 3,
                    name: 'action',
                    description: 'whether to add or remove the role',
                    required: true,
                    choices: [
                        { name: 'add', value: 'add' },
                        { name: 'remove', value: 'remove' },
                    ],
                },
                {
                    type: 6,
                    name: 'user',
                    description: 'the user to modify roles for',
                    required: true,
                },
                {
                    type: 8,
                    name: 'role',
                    description: 'the role to add or remove',
                    required: true,
                },
                {
                    type: 3,
                    name: 'reason',
                    description: 'reason for the role change',
                    required: false,
                },
            ],
        },
        {
            name: 'purge',
            description: 'deletes a specified number of messages',
            options: [
                {
                    type: 4,
                    name: 'amount',
                    description: 'number of messages to delete (1-100)',
                    required: true,
                },
            ],
        },
        {
            name: 'cooldown',
            description: 'set or view channel cooldown',
            options: [
                {
                    type: 4,
                    name: 'duration',
                    description: 'cooldown duration in seconds (0 to disable)',
                    required: false,
                },
            ],
        },
        {
            name: 'filter',
            description: 'set or view channel message filter',
            options: [
                {
                    type: 3,
                    name: 'action',
                    description: 'set, remove, or view filter',
                    required: false,
                    choices: [
                        { name: 'set', value: 'set' },
                        { name: 'remove', value: 'remove' },
                        { name: 'view', value: 'view' },
                    ],
                },
                {
                    type: 3,
                    name: 'pattern',
                    description: 'regex pattern to filter (for set action)',
                    required: false,
                },
            ],
        },
        {
            name: 'announce',
            description: 'make an announcement in a channel',
            options: [
                {
                    type: 7,
                    name: 'channel',
                    description: 'the channel to announce in',
                    required: true,
                },
                {
                    type: 3,
                    name: 'message',
                    description: 'the announcement message',
                    required: true,
                },
            ],
        },
        {
            name: 'note',
            description: 'add or view notes on a user',
            options: [
                {
                    type: 6,
                    name: 'user',
                    description: 'the user to add/view notes for',
                    required: true,
                },
                {
                    type: 3,
                    name: 'action',
                    description: 'add or view notes',
                    required: false,
                    choices: [
                        { name: 'add', value: 'add' },
                        { name: 'view', value: 'view' },
                    ],
                },
                {
                    type: 3,
                    name: 'content',
                    description: 'note content (for add action)',
                    required: false,
                },
            ],
        },
        {
            name: 'tempban',
            description: 'temporarily ban a user',
            options: [
                {
                    type: 6,
                    name: 'user',
                    description: 'the user to tempban',
                    required: true,
                },
                {
                    type: 4,
                    name: 'duration',
                    description: 'ban duration in hours',
                    required: true,
                },
                {
                    type: 3,
                    name: 'reason',
                    description: 'reason for tempban',
                    required: false,
                },
            ],
        },
        {
            name: 'warn',
            description: 'warn a user or view warnings',
            options: [
                {
                    type: 6,
                    name: 'user',
                    description: 'the user to warn or view warnings for',
                    required: true,
                },
                {
                    type: 3,
                    name: 'action',
                    description: 'add or view warnings',
                    required: false,
                    choices: [
                        { name: 'add', value: 'add' },
                        { name: 'view', value: 'view' },
                        { name: 'clear', value: 'clear' },
                    ],
                },
                {
                    type: 3,
                    name: 'reason',
                    description: 'reason for warning (for add action)',
                    required: false,
                },
            ],
        },
    ];

    await client.application.commands.set(commands);
});

// Helper function to check admin role
function isAdmin(member) {
    return member.roles.cache.has(ADMIN_ROLE_ID);
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'help') {
        await interaction.reply(
            '**prefix:** `$` (with a space after)\n' +
            '**commands:**\n' +
            '`help` - displays help data\n' +
            '`stats` - displays bot statistics\n' +
            '`say` - makes the bot say something\n' +
            '`ban` - bans a user\n' +
            '`unban` - unbans a user by id\n' +
            '`softban` - bans then unbans to clear messages\n' +
            '`kick` - kicks a user\n' +
            '`mute` - timeouts a user\n' +
            '`unmute` - removes timeout\n' +
            '`role` - add or remove a role from a user\n' +
            '`purge` - deletes messages\n' +
            '`cooldown` - set channel cooldown\n' +
            '`filter` - set channel message filter\n' +
            '`announce` - make an announcement\n' +
            '`note` - add or view user notes\n' +
            '`tempban` - temporarily ban a user\n' +
            '`warn` - warn a user or view warnings\n' +
            '(shell administrator)\n' +
            '`shutdown` - shuts down the bot'
        );
    }

    if (interaction.commandName === 'stats') {
        const uptimeMs = Date.now() - botStartTime;
        const uptimeDays = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
        const uptimeHours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
        const uptimeSeconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);

        const memUsage = process.memoryUsage();
        const memUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
        const memTotal = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
        const systemRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const systemRamUsed = ((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(2);

        const cpuPercent = (os.loadavg()[0] / os.cpus().length * 100).toFixed(1);

        await interaction.reply(
            '**📊 Bot Statistics**\n' +
            `**Uptime:** ${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s\n` +
            `**CPU:** ${cpuPercent}% (system load)\n` +
            `**RAM:** ${memUsed}MB / ${memTotal}MB (bot) | ${systemRamUsed}GB / ${systemRam}GB (system)`
        );
    }

    if (interaction.commandName === 'say') {
        const text = interaction.options.getString('text');
        await interaction.reply(text);
    }

    if (interaction.commandName === 'shutdown') {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({
                content: 'you do not have the shell administrator role.',
                ephemeral: true
            });
        }
        await interaction.reply('hold on...');
        await client.destroy();
        process.exit(0);
    }

    if (interaction.commandName === 'ban') {
        if (!interaction.memberPermissions.has('BanMembers')) {
            return interaction.reply({ content: 'you need the Ban Members permission to use this command.', ephemeral: true });
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
        if (!interaction.memberPermissions.has('BanMembers')) {
            return interaction.reply({ content: 'you need the Ban Members permission to use this command.', ephemeral: true });
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
        if (!interaction.memberPermissions.has('BanMembers')) {
            return interaction.reply({ content: 'you need the Ban Members permission to use this command.', ephemeral: true });
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
        if (!interaction.memberPermissions.has('KickMembers')) {
            return interaction.reply({ content: 'you need the Kick Members permission to use this command.', ephemeral: true });
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
        if (!interaction.memberPermissions.has('ModerateMembers')) {
            return interaction.reply({ content: 'you need the Moderate Members permission to use this command.', ephemeral: true });
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
        if (!interaction.memberPermissions.has('ModerateMembers')) {
            return interaction.reply({ content: 'you need the Moderate Members permission to use this command.', ephemeral: true });
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

    // NEW COMMAND HANDLERS

    if (interaction.commandName === 'role') {
        if (!interaction.memberPermissions.has('ManageRoles')) {
            return interaction.reply({ content: 'you need the Manage Roles permission to use this command.', ephemeral: true });
        }
        const action = interaction.options.getString('action', true);
        const user = interaction.options.getUser('user', true);
        const role = interaction.options.getRole('role', true);
        const reason = interaction.options.getString('reason') || 'no reason provided';

        const member = interaction.guild.members.cache.get(user.id);
        if (!member) {
            return interaction.reply({ content: 'user not found in this server.', ephemeral: true });
        }

        // Check role hierarchy
        if (role.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: 'cannot modify roles higher than or equal to your highest role.', ephemeral: true });
        }

        if (action === 'add') {
            if (member.roles.cache.has(role.id)) {
                return interaction.reply({ content: 'user already has that role.', ephemeral: true });
            }
            await member.roles.add(role, reason);
            await interaction.reply(`added role ${role.name} to ${user.tag}. reason: ${reason}`);
        } else if (action === 'remove') {
            if (!member.roles.cache.has(role.id)) {
                return interaction.reply({ content: 'user does not have that role.', ephemeral: true });
            }
            await member.roles.remove(role, reason);
            await interaction.reply(`removed role ${role.name} from ${user.tag}. reason: ${reason}`);
        }
    }

    if (interaction.commandName === 'purge') {
        if (!interaction.memberPermissions.has('ManageMessages')) {
            return interaction.reply({ content: 'you need the Manage Messages permission to use this command.', ephemeral: true });
        }
        const amount = interaction.options.getInteger('amount', true);
        if (amount < 1 || amount > 100) {
            return interaction.reply({ content: 'amount must be between 1 and 100.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const deleted = await interaction.channel.bulkDelete(amount, true);
        await interaction.editReply(`deleted ${deleted.size} message(s).`);
    }

    if (interaction.commandName === 'cooldown') {
        if (!interaction.memberPermissions.has('ManageChannels')) {
            return interaction.reply({ content: 'you need the Manage Channels permission to use this command.', ephemeral: true });
        }

        const duration = interaction.options.getInteger('duration');
        const channelId = interaction.channel.id;

        if (duration === null || duration === undefined) {
            // View current cooldown
            const cooldown = channelCooldowns.get(channelId);
            if (!cooldown) {
                return interaction.reply({ content: `no cooldown set for this channel.`, ephemeral: true });
            }
            const seconds = Math.floor(cooldown.duration / 1000);
            return interaction.reply({ content: `current cooldown: ${seconds} second(s).`, ephemeral: true });
        }

        if (duration < 0) {
            return interaction.reply({ content: 'duration must be 0 or greater.', ephemeral: true });
        }

        if (duration === 0) {
            channelCooldowns.delete(channelId);
            return interaction.reply({ content: 'cooldown removed for this channel.', ephemeral: true });
        }

        channelCooldowns.set(channelId, { duration: duration * 1000, lastMessage: 0 });
        await interaction.reply({ content: `cooldown set to ${duration} second(s) for this channel.`, ephemeral: true });
    }

    if (interaction.commandName === 'filter') {
        if (!interaction.memberPermissions.has('ManageMessages')) {
            return interaction.reply({ content: 'you need the Manage Messages permission to use this command.', ephemeral: true });
        }

        const action = interaction.options.getString('action') || 'view';
        const pattern = interaction.options.getString('pattern');
        const channelId = interaction.channel.id;

        if (action === 'view') {
            const filter = channelCooldowns.get(`${channelId}_filter`);
            if (!filter) {
                return interaction.reply({ content: 'no filter set for this channel.', ephemeral: true });
            }
            return interaction.reply({ content: `current filter pattern: \`${filter.pattern}\``, ephemeral: true });
        }

        if (action === 'set') {
            if (!pattern) {
                return interaction.reply({ content: 'you must provide a regex pattern.', ephemeral: true });
            }
            try {
                new RegExp(pattern);
            } catch (e) {
                return interaction.reply({ content: 'invalid regex pattern.', ephemeral: true });
            }
            channelCooldowns.set(`${channelId}_filter`, { pattern });
            return interaction.reply({ content: `filter set to: \`${pattern}\``, ephemeral: true });
        }

        if (action === 'remove') {
            channelCooldowns.delete(`${channelId}_filter`);
            return interaction.reply({ content: 'filter removed for this channel.', ephemeral: true });
        }
    }

    if (interaction.commandName === 'announce') {
        if (!interaction.memberPermissions.has('ManageMessages') && !isAdmin(interaction.member)) {
            return interaction.reply({ content: 'you need the Manage Messages permission or administrator role to use this command.', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel', true);
        const message = interaction.options.getString('message', true);

        // Make sure the channel is a text channel
        if (!channel.isTextBased()) {
            return interaction.reply({ content: 'the specified channel is not a text channel.', ephemeral: true });
        }

        await channel.send(`**📢 Announcement**\n\n${message}`);
        await interaction.reply({ content: 'announcement sent.', ephemeral: true });
    }

    if (interaction.commandName === 'note') {
        if (!interaction.memberPermissions.has('ModerateMembers')) {
            return interaction.reply({ content: 'you need the Moderate Members permission to use this command.', ephemeral: true });
        }

        const user = interaction.options.getUser('user', true);
        const action = interaction.options.getString('action') || 'view';
        const content = interaction.options.getString('content');

        const guildId = interaction.guild.id;
        const userId = user.id;

        if (action === 'view') {
            const guildNotes = userNotes.get(guildId);
            const notes = guildNotes?.get(userId) || [];

            if (notes.length === 0) {
                return interaction.reply({ content: `no notes found for ${user.tag}.`, ephemeral: true });
            }

            let noteList = `**Notes for ${user.tag}:**\n`;
            notes.forEach((note, index) => {
                noteList += `${index + 1}. ${note.note} (by ${note.author} on ${new Date(note.timestamp).toLocaleDateString()})\n`;
            });

            return interaction.reply({ content: noteList, ephemeral: true });
        }

        if (action === 'add') {
            if (!content) {
                return interaction.reply({ content: 'you must provide note content.', ephemeral: true });
            }

            if (!userNotes.has(guildId)) {
                userNotes.set(guildId, new Map());
            }
            const guildNotes = userNotes.get(guildId);
            if (!guildNotes.has(userId)) {
                guildNotes.set(userId, []);
            }

            guildNotes.get(userId).push({
                note: content,
                author: interaction.user.tag,
                timestamp: Date.now(),
            });

            return interaction.reply({ content: `added note for ${user.tag}.`, ephemeral: true });
        }
    }

    if (interaction.commandName === 'tempban') {
        if (!interaction.memberPermissions.has('BanMembers')) {
            return interaction.reply({ content: 'you need the Ban Members permission to use this command.', ephemeral: true });
        }

        const user = interaction.options.getUser('user', true);
        const duration = interaction.options.getInteger('duration', true);
        const reason = interaction.options.getString('reason') || 'no reason provided';

        const member = interaction.guild.members.cache.get(user.id);
        if (!member) {
            return interaction.reply({ content: 'user not found in this server.', ephemeral: true });
        }
        if (!member.bannable) {
            return interaction.reply({ content: 'cannot tempban that user. check role hierarchy and permissions.', ephemeral: true });
        }

        await member.ban({ reason: `tempban: ${reason}` });

        const unbanTime = duration * 60 * 60 * 1000; // hours to ms
        setTimeout(async () => {
            try {
                await interaction.guild.members.unban(user.id, 'tempban expired');
                console.log(`unbanned ${user.tag} after tempban expired`);
            } catch (err) {
                console.error(`failed to unban ${user.tag}:`, err);
            }
        }, unbanTime);

        await interaction.reply(`tempbanned ${user.tag} for ${duration} hour(s). reason: ${reason}`);
    }

    if (interaction.commandName === 'warn') {
        if (!interaction.memberPermissions.has('ModerateMembers')) {
            return interaction.reply({ content: 'you need the Moderate Members permission to use this command.', ephemeral: true });
        }

        const user = interaction.options.getUser('user', true);
        const action = interaction.options.getString('action') || 'add';
        const reason = interaction.options.getString('reason');

        const guildId = interaction.guild.id;
        const userId = user.id;

        if (action === 'view') {
            const guildWarns = userWarns.get(guildId);
            const warns = guildWarns?.get(userId) || [];

            if (warns.length === 0) {
                return interaction.reply({ content: `no warnings found for ${user.tag}.`, ephemeral: true });
            }

            let warnList = `**Warnings for ${user.tag} (${warns.length}):**\n`;
            warns.forEach((warn, index) => {
                warnList += `${index + 1}. ${warn.reason} (by ${warn.author} on ${new Date(warn.timestamp).toLocaleDateString()})\n`;
            });

            return interaction.reply({ content: warnList, ephemeral: true });
        }

        if (action === 'add') {
            if (!reason) {
                return interaction.reply({ content: 'you must provide a reason for the warning.', ephemeral: true });
            }

            if (!userWarns.has(guildId)) {
                userWarns.set(guildId, new Map());
            }
            const guildWarns = userWarns.get(guildId);
            if (!guildWarns.has(userId)) {
                guildWarns.set(userId, []);
            }

            guildWarns.get(userId).push({
                reason: reason,
                author: interaction.user.tag,
                timestamp: Date.now(),
            });

            const warnCount = guildWarns.get(userId).length;
            await interaction.reply({ content: `warned ${user.tag} (${warnCount} total warnings). reason: ${reason}`, ephemeral: false });

            // Try to DM the user
            try {
                await user.send(`You have been warned in **${interaction.guild.name}**. Reason: ${reason}`);
            } catch (err) {
                // Could not DM user
            }
        }

        if (action === 'clear') {
            const guildWarns = userWarns.get(guildId);
            if (!guildWarns || !guildWarns.has(userId)) {
                return interaction.reply({ content: `no warnings to clear for ${user.tag}.`, ephemeral: true });
            }

            guildWarns.delete(userId);
            return interaction.reply({ content: `cleared all warnings for ${user.tag}.`, ephemeral: true });
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Check channel cooldown
    const cooldown = channelCooldowns.get(message.channel.id);
    if (cooldown) {
        const now = Date.now();
        const timeSinceLastMessage = now - cooldown.lastMessage;
        if (timeSinceLastMessage < cooldown.duration) {
            const remaining = Math.ceil((cooldown.duration - timeSinceLastMessage) / 1000);
            try {
                await message.delete();
                await message.channel.send(`${message.author}, you must wait ${remaining} second(s) before sending another message.`).then(m => setTimeout(() => m.delete(), 5000));
            } catch (err) { /* ignore */ }
            return;
        }
        cooldown.lastMessage = now;
    }

    // Check channel filter
    const filter = channelCooldowns.get(`${message.channel.id}_filter`);
    if (filter) {
        try {
            const regex = new RegExp(filter.pattern, 'i');
            if (regex.test(message.content)) {
                try {
                    await message.delete();
                    await message.channel.send(`${message.author}, your message contains filtered content.`).then(m => setTimeout(() => m.delete(), 5000));
                } catch (err) { /* ignore */ }
                return;
            }
        } catch (e) { /* invalid regex, ignore */ }
    }

    if (command === 'say') {
        const text = message.content.slice(PREFIX.length).trim().slice('say'.length).trim();
        if (!text) return message.reply('**usage:** $ say <input>');
        await message.channel.send(text);
    }

    if (command === 'help') {
        await message.reply(
            '**prefix:** `$` (with a space after)\n' +
            '**commands:**\n' +
            '`help` - displays help data\n' +
            '`stats` - displays bot statistics\n' +
            '`say` - makes the bot say something\n' +
            '`ban` - bans a user\n' +
            '`unban` - unbans a user by id\n' +
            '`softban` - bans then unbans to clear messages\n' +
            '`kick` - kicks a user\n' +
            '`mute` - timeouts a user\n' +
            '`unmute` - removes timeout\n' +
            '`role` - add or remove a role from a user\n' +
            '`purge` - deletes messages\n' +
            '`cooldown` - set channel cooldown\n' +
            '`filter` - set channel message filter\n' +
            '`announce` - make an announcement\n' +
            '`note` - add or view user notes\n' +
            '`tempban` - temporarily ban a user\n' +
            '`warn` - warn a user or view warnings\n' +
            '(shell administrator)\n' +
            '`shutdown` - shuts down the bot'
        );
    }

    if (command === 'stats') {
        const uptimeMs = Date.now() - botStartTime;
        const uptimeDays = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
        const uptimeHours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
        const uptimeSeconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);

        const memUsage = process.memoryUsage();
        const ramUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
        const ramTotal = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
        const systemRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const systemRamUsed = ((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(2);

        const cpuPercent = (os.loadavg()[0] / os.cpus().length * 100).toFixed(1);

        await message.reply(
            '**shell stats**\n' +
            `**uptime:** ${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s\n` +
            `**cpu:** ${cpuPercent}%\n` +
            `**ram:** ${ramUsed}MB / ${ramTotal}MB`
        );
    }

    if (command === 'shutdown') {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return message.reply('you do not have the shell administrator role.');
        }
        await message.channel.send('hold on...');
        await client.destroy();
        process.exit(0);
    }

    if (command === 'ban') {
        if (!message.member.permissions.has('BanMembers')) {
            return message.reply('you need the Ban Members permission to use this command.');
        }
        const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('**usage:** $ ban <@user|id> [reason]');
        const reason = args.slice(1).join(' ') || 'no reason provided';
        if (!target.bannable) return message.reply('cannot ban that user. check role hierarchy and permissions.');
        await target.ban({ reason: reason });
        await message.channel.send(`banned ${target.user.tag} (${target.id}). reason: ${reason}`);
    }

    if (command === 'unban') {
        if (!message.member.permissions.has('BanMembers')) {
            return message.reply('you need the Ban Members permission to use this command.');
        }
        const userId = args[0];
        if (!userId) return message.reply('**usage:** $ unban <user_id> [reason]');
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
        if (!message.member.permissions.has('BanMembers')) {
            return message.reply('you need the Ban Members permission to use this command.');
        }
        const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('**usage:** $ softban <@user|id> [reason]');
        const reason = args.slice(1).join(' ') || 'no reason provided';
        if (!target.bannable) return message.reply('cannot softban that user. check role hierarchy and permissions.');
        await target.ban({ reason: reason, deleteMessageDays: 7 });
        await message.guild.members.unban(target.id, 'softban clear messages');
        await message.channel.send(`softbanned ${target.user.tag} (${target.id}). messages cleared. reason: ${reason}`);
    }

    if (command === 'kick') {
        if (!message.member.permissions.has('KickMembers')) {
            return message.reply('you need the Kick Members permission to use this command.');
        }
        const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('**usage:** $ kick <@user|id> [reason]');
        const reason = args.slice(1).join(' ') || 'no reason provided';
        if (!target.kickable) return message.reply('cannot kick that user. check role hierarchy and permissions.');
        await target.kick(reason);
        await message.channel.send(`kicked ${target.user.tag} (${target.id}). reason: ${reason}`);
    }

    if (command === 'mute') {
        if (!message.member.permissions.has('ModerateMembers')) {
            return message.reply('you need the Moderate Members permission to use this command.');
        }
        const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('**usage:** $ mute <@user|id> <minutes> [reason]');
        const minutes = parseInt(args[1]);
        if (isNaN(minutes) || minutes <= 0) return message.reply('**usage:** $ mute <@user|id> <minutes> [reason]');
        const reason = args.slice(2).join(' ') || 'no reason provided';
        if (!target.moderatable) return message.reply('cannot mute that user. check role hierarchy and permissions.');
        await target.timeout(minutes * 60 * 1000, reason);
        await message.channel.send(`muted ${target.user.tag} for ${minutes} minute(s). reason: ${reason}`);
    }

    if (command === 'unmute') {
        if (!message.member.permissions.has('ModerateMembers')) {
            return message.reply('you need the Moderate Members permission to use this command.');
        }
        const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('**usage:** $ unmute <@user|id> [reason]');
        const reason = args.slice(1).join(' ') || 'no reason provided';
        if (!target.moderatable) return message.reply('cannot unmute that user. check role hierarchy and permissions.');
        await target.timeout(null, reason);
        await message.channel.send(`unmuted ${target.user.tag}. reason: ${reason}`);
    }

    // NEW PREFIX COMMAND HANDLERS

    if (command === 'role') {
        if (!message.member.permissions.has('ManageRoles')) {
            return message.reply('you need the Manage Roles permission to use this command.');
        }

        if (args.length < 3) {
            return message.reply('**usage:** $ role <add/remove> <@user> <@role|role_id> [reason]');
        }

        const action = args[0].toLowerCase();
        if (!['add', 'remove'].includes(action)) {
            return message.reply('**usage:** action must be `add` or `remove`');
        }

        const target = message.mentions.members.first() || await message.guild.members.fetch(args[1]).catch(() => null);
        if (!target) return message.reply('**usage:** user not found');

        // Get role from mention or ID
        let role;
        if (message.mentions.roles.size > 0) {
            role = message.mentions.roles.first();
        } else {
            role = message.guild.roles.cache.get(args[2]) || message.guild.roles.cache.find(r => r.name.toLowerCase() === args[2].toLowerCase());
        }

        if (!role) return message.reply('**usage:** role not found');

        // Check role hierarchy
        if (role.position >= message.member.roles.highest.position) {
            return message.reply('cannot modify roles higher than or equal to your highest role.');
        }

        const reason = args.slice(3).join(' ') || 'no reason provided';

        if (action === 'add') {
            if (target.roles.cache.has(role.id)) {
                return message.reply('user already has that role.');
            }
            await target.roles.add(role, reason);
            await message.channel.send(`added role ${role.name} to ${target.user.tag}. reason: ${reason}`);
        } else if (action === 'remove') {
            if (!target.roles.cache.has(role.id)) {
                return message.reply('user does not have that role.');
            }
            await target.roles.remove(role, reason);
            await message.channel.send(`removed role ${role.name} from ${target.user.tag}. reason: ${reason}`);
        }
    }

    if (command === 'purge') {
        if (!message.member.permissions.has('ManageMessages')) {
            return message.reply('you need the Manage Messages permission to use this command.');
        }

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply('**usage:** $ purge <amount> (1-100)');
        }

        const deleted = await message.channel.bulkDelete(amount, true);
        await message.channel.send(`deleted ${deleted.size} message(s).`).then(m => setTimeout(() => m.delete(), 5000));
    }

    if (command === 'cooldown') {
        if (!message.member.permissions.has('ManageChannels')) {
            return message.reply('you need the Manage Channels permission to use this command.');
        }

        const channelId = message.channel.id;

        if (args.length === 0) {
            const cooldown = channelCooldowns.get(channelId);
            if (!cooldown) {
                return message.reply('no cooldown set for this channel.');
            }
            const seconds = Math.floor(cooldown.duration / 1000);
            return message.reply(`current cooldown: ${seconds} second(s).`);
        }

        const duration = parseInt(args[0]);
        if (isNaN(duration) || duration < 0) {
            return message.reply('**usage:** $ cooldown <seconds> (0 to disable)');
        }

        if (duration === 0) {
            channelCooldowns.delete(channelId);
            return message.reply('cooldown removed for this channel.');
        }

        channelCooldowns.set(channelId, { duration: duration * 1000, lastMessage: 0 });
        await message.reply(`cooldown set to ${duration} second(s) for this channel.`);
    }

    if (command === 'filter') {
        if (!message.member.permissions.has('ManageMessages')) {
            return message.reply('you need the Manage Messages permission to use this command.');
        }

        const channelId = message.channel.id;

        if (args.length === 0 || args[0] === 'view') {
            const filter = channelCooldowns.get(`${channelId}_filter`);
            if (!filter) {
                return message.reply('no filter set for this channel.');
            }
            return message.reply(`current filter pattern: \`${filter.pattern}\``);
        }

        if (args[0] === 'set') {
            const pattern = args.slice(1).join(' ');
            if (!pattern) {
                return message.reply('**usage:** $ filter set <regex pattern>');
            }
            try {
                new RegExp(pattern);
            } catch (e) {
                return message.reply('invalid regex pattern.');
            }
            channelCooldowns.set(`${channelId}_filter`, { pattern });
            return message.reply(`filter set to: \`${pattern}\``);
        }

        if (args[0] === 'remove') {
            channelCooldowns.delete(`${channelId}_filter`);
            return message.reply('filter removed for this channel.');
        }

        return message.reply('**usage:** $ filter <set/remove/view> [pattern]');
    }

    if (command === 'announce') {
        if (!message.member.permissions.has('ManageMessages') && !isAdmin(message.member)) {
            return message.reply('you need the Manage Messages permission or administrator role to use this command.');
        }

        if (args.length < 2) {
            return message.reply('**usage:** $ announce #channel <message>');
        }

        const channel = message.mentions.channels.first();
        if (!channel) {
            return message.reply('**usage:** please mention a valid channel');
        }

        if (!channel.isTextBased()) {
            return message.reply('the specified channel is not a text channel.');
        }

        const announcement = args.slice(2).join(' ');
        if (!announcement) {
            return message.reply('**usage:** please provide an announcement message');
        }

        await channel.send(`**📢 Announcement**\n\n${announcement}`);
        await message.reply('announcement sent.');
    }

    if (command === 'note') {
        if (!message.member.permissions.has('ModerateMembers')) {
            return message.reply('you need the Moderate Members permission to use this command.');
        }

        if (args.length < 1) {
            return message.reply('**usage:** $ note <@user> [add/view] [content]');
        }

        const target = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('user not found.');

        const guildId = message.guild.id;
        const userId = target.id;
        const action = args[1] || 'view';

        if (action === 'view') {
            const guildNotes = userNotes.get(guildId);
            const notes = guildNotes?.get(userId) || [];

            if (notes.length === 0) {
                return message.reply(`no notes found for ${target.tag}.`);
            }

            let noteList = `**Notes for ${target.tag}:**\n`;
            notes.forEach((note, index) => {
                noteList += `${index + 1}. ${note.note} (by ${note.author} on ${new Date(note.timestamp).toLocaleDateString()})\n`;
            });

            return message.reply(noteList);
        }

        if (action === 'add') {
            const content = args.slice(2).join(' ');
            if (!content) {
                return message.reply('**usage:** $ note <@user> add <content>');
            }

            if (!userNotes.has(guildId)) {
                userNotes.set(guildId, new Map());
            }
            const guildNotes = userNotes.get(guildId);
            if (!guildNotes.has(userId)) {
                guildNotes.set(userId, []);
            }

            guildNotes.get(userId).push({
                note: content,
                author: message.author.tag,
                timestamp: Date.now(),
            });

            return message.reply(`added note for ${target.tag}.`);
        }
    }

    if (command === 'tempban') {
        if (!message.member.permissions.has('BanMembers')) {
            return message.reply('you need the Ban Members permission to use this command.');
        }

        if (args.length < 2) {
            return message.reply('**usage:** $ tempban <@user|id> <hours> [reason]');
        }

        const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('user not found in this server.');
        if (!target.bannable) return message.reply('cannot tempban that user. check role hierarchy and permissions.');

        const duration = parseInt(args[1]);
        if (isNaN(duration) || duration <= 0) {
            return message.reply('**usage:** duration must be a positive number of hours');
        }

        const reason = args.slice(2).join(' ') || 'no reason provided';

        await target.ban({ reason: `tempban: ${reason}` });

        const unbanTime = duration * 60 * 60 * 1000;
        setTimeout(async () => {
            try {
                await message.guild.members.unban(target.user.id, 'tempban expired');
                console.log(`unbanned ${target.user.tag} after tempban expired`);
            } catch (err) {
                console.error(`failed to unban ${target.user.tag}:`, err);
            }
        }, unbanTime);

        await message.channel.send(`tempbanned ${target.user.tag} for ${duration} hour(s). reason: ${reason}`);
    }

    if (command === 'warn') {
        if (!message.member.permissions.has('ModerateMembers')) {
            return message.reply('you need the Moderate Members permission to use this command.');
        }

        if (args.length < 1) {
            return message.reply('**usage:** $ warn <@user> [add/view/clear] [reason]');
        }

        const target = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('user not found.');

        const guildId = message.guild.id;
        const userId = target.id;
        const action = args[1] || 'add';

        if (action === 'view') {
            const guildWarns = userWarns.get(guildId);
            const warns = guildWarns?.get(userId) || [];

            if (warns.length === 0) {
                return message.reply(`no warnings found for ${target.tag}.`);
            }

            let warnList = `**Warnings for ${target.tag} (${warns.length}):**\n`;
            warns.forEach((warn, index) => {
                warnList += `${index + 1}. ${warn.reason} (by ${warn.author} on ${new Date(warn.timestamp).toLocaleDateString()})\n`;
            });

            return message.reply(warnList);
        }

        if (action === 'add') {
            const reason = args.slice(2).join(' ');
            if (!reason) {
                return message.reply('**usage:** $ warn <@user> add <reason>');
            }

            if (!userWarns.has(guildId)) {
                userWarns.set(guildId, new Map());
            }
            const guildWarns = userWarns.get(guildId);
            if (!guildWarns.has(userId)) {
                guildWarns.set(userId, []);
            }

            guildWarns.get(userId).push({
                reason: reason,
                author: message.author.tag,
                timestamp: Date.now(),
            });

            const warnCount = guildWarns.get(userId).length;
            await message.channel.send(`**⚠️ Warning for ${target.tag}**\nReason: ${reason}\nTotal warnings: ${warnCount}`);

            // Try to DM the user
            try {
                await target.send(`You have been warned in **${message.guild.name}**. Reason: ${reason}`);
            } catch (err) { /* could not DM */ }
        }

        if (action === 'clear') {
            const guildWarns = userWarns.get(guildId);
            if (!guildWarns || !guildWarns.has(userId)) {
                return message.reply(`no warnings to clear for ${target.tag}.`);
            }

            guildWarns.delete(userId);
            return message.reply(`cleared all warnings for ${target.tag}.`);
        }
    }
});

client.login(process.env.TOKEN);

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM signal. Shutting down gracefully...');
    if (client) {
        await client.destroy();
        console.log('Discord client destroyed.');
    }
    process.exit(0);
});