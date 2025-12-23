const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { fetch } = require("undici");
const fs = require("fs");
const path = require("path");
const config = require("./config.json");
const { console } = require("inspector");

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const STATUS_URL = `https://servers-frontend.fivem.net/api/servers/single/${config.cfxJoin}`;

const RECORD_FILE = path.join(__dirname, "record.json");
let record = { players: 0, date: "Jamais" };
if (fs.existsSync(RECORD_FILE)) {
    try { record = JSON.parse(fs.readFileSync(RECORD_FILE, "utf8")); } catch {}
}
function saveRecord() { fs.writeFileSync(RECORD_FILE, JSON.stringify(record, null, 2)); }

const STATUS_FILE = path.join(__dirname, "status.json");
let statusData = { messageId: null };
if (fs.existsSync(STATUS_FILE)) {
    try { statusData = JSON.parse(fs.readFileSync(STATUS_FILE, "utf8")); } catch {}
}

const CHANNEL_ID = config.channelId;
let statusMessage;
let previousPlayers = null;
let previousPing = null;

const logoPath = path.join(__dirname, "image/logo.png");
const logoAttachment = new AttachmentBuilder(logoPath);

const buttons = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setLabel("Se connecter")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://cfx.re/join/${config.cfxJoin}`)
            .setEmoji("🚀"),
        new ButtonBuilder()
            .setLabel("Discord")
            .setStyle(ButtonStyle.Link)
            .setURL(config.discordInvite)
            .setEmoji("🔗")
    );

async function updateStatus() {
    try {
        const start = Date.now();
        const res = await fetch(`${STATUS_URL}?_=${Date.now()}`);
        const json = await res.json();
        const ping = Date.now() - start;

        let embed;
        let activityText;

        if (json?.Data) {
            const players = json.Data.clients;
            const maxPlayers = json.Data.sv_maxclients;

            if (players > record.players) {
                record.players = players;
                record.date = new Date().toLocaleString("fr-FR");
                saveRecord();
            }

            embed = new EmbedBuilder()
                .setTitle("Name - Statut serveur", { url: config.discordInvite })
                .setDescription(`**Connexion via F8**\n\`\`\`connect cfx.re/join/${config.cfxJoin}\`\`\``)
                .setThumbnail("attachment://logo.png")
                .addFields(
                    { name: "Name", value: "```🟢 Online```", inline: true },
                    { name: "FiveM", value: "```🟢 Online```", inline: true },
                    { name: "FiveM API", value: "```🟢 Online```", inline: true },
                    { name: "Joueurs", value: `\`\`\`${players}/${maxPlayers}\`\`\``, inline: true },
                    { name: "Ping", value: `\`\`\`${ping} ms\`\`\``, inline: true },
                    { name: "\u200b", value: "\u200b", inline: true },
                    { name: "Record de Joueurs", value: `\`\`\`${record.players} Joueurs - ${record.date}\`\`\`` }
                )
                .setFooter({ text: "@Name", iconURL: "attachment://logo.png" });

            activityText = `${players}/${maxPlayers} joueurs en ligne`;

            if (previousPlayers !== players || previousPing !== ping) {
                const channel = await client.channels.fetch(CHANNEL_ID);

                if (!statusMessage && statusData.messageId) {
                    try { statusMessage = await channel.messages.fetch(statusData.messageId); } catch { statusMessage = null; }
                }

                if (!statusMessage) {
                    statusMessage = await channel.send({ embeds: [embed], files: [logoAttachment], components: [buttons] });
                    statusData.messageId = statusMessage.id;
                    fs.writeFileSync(STATUS_FILE, JSON.stringify(statusData, null, 2));
                } else {
                    await statusMessage.edit({ embeds: [embed], components: [buttons] });
                }

                previousPlayers = players;
                previousPing = ping;
            }

        } else {
            embed = new EmbedBuilder()
                .setTitle("Name - Statut serveur", { url: config.discordInvite })
                .setDescription("```🔴 Serveur hors ligne```")
                .setFooter({ text: "@Name", iconURL: "attachment://logo.png" });

            activityText = "Serveur hors ligne";

            if (statusMessage) {
                await statusMessage.edit({ embeds: [embed], components: [buttons] });
            }
        }

        await client.user.setPresence({
            activities: [{ name: activityText, type: 3 }],
            status: json?.Data ? "online" : "dnd"
        });

    } catch (err) {
        console.error("Erreur lors de la mise à jour du status :", err);
        if (client.user) {
            await client.user.setPresence({
                activities: [{ name: `Erreur serveur`, type: 3 }],
                status: "dnd"
            });
        }
    }
}

client.once("clientReady", async () => {
    console.log(`✅ Connecté : ${client.user.tag}`);
    await updateStatus();
    setInterval(updateStatus, 2000);
});

client.login(config.token);