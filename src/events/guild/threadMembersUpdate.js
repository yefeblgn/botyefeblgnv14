// Dependencies
const { Embed } = require('../../utils'),
	{ loggingSystem } = require('../../database/models'),
	Event = require('../../structures/Event');

module.exports = class threadMembersUpdate extends Event {
	constructor(...args) {
		super(...args, {
			dirname: __dirname,
		});
	}

	// Exec event
	async run(bot, oldMembers, newMembers) {
		// Get thread
		const thread = oldMembers.first()?.thread ?? newMembers.first()?.thread;

		// For debugging
		if (bot.config.debug) bot.logger.debug(`Thread: ${thread.name} member count has been updated in guild: ${thread.guildId}. (${thread.type.split('_')[1]})`);

		// Get server settings / if no settings then return
		const settings = thread.guild.settings;
		if (Object.keys(settings).length == 0) return;

		// SE CONECTA NA DB DE LOGS
		let logDB = await loggingSystem.findOne({ _id: thread.guild.id });
		if (!logDB) {
			const newSettings = new loggingSystem({
				_id: thread.guild.id
			});
			await newSettings.save().catch(() => { });
			logDB = await loggingSystem.findOne({ _id: thread.guild.id });
		}

		// Check if event channelDelete is for logging
		if (logDB.ServerEvents.ThreadMembersUpdateToggle == true && logDB.ServerEvents.Toggle == true) {
			// CHECK A COR E DEFINE A COR DEFAULT
			let color = logDB.ServerEvents.EmbedColor;
			if (color == "#000000") color = 15105570;
			// emoji role update
			if (oldMembers.size != newMembers.size) {
				const memberAdded = newMembers.filter(x => !oldMembers.get(x.id));
				const memberRemoved = oldMembers.filter(x => !newMembers.get(x.id));
				if (memberAdded.size != 0 || memberRemoved.size != 0) {
					const memberAddedString = [];
					for (const role of [...memberAdded.values()]) {
						memberAddedString.push(`${thread.guild.members.cache.get(role.id)}`);
					}
					const memberRemovedString = [];
					for (const role of [...memberRemoved.values()]) {
						memberRemovedString.push(`${thread.guild.members.cache.get(role.id)}`);
					}

					// create embed
					const embed = new Embed(bot, thread.guild)
						.setDescription(`**Thread members updated in ${thread.toString()}**`)
						.setColor(color)
						.setFooter({ text: `ID: ${thread.id}` })
						.setAuthor({ name: `${thread.guild.name}`, iconURL: `${thread.guild.iconURL()}` })
						.addFields(
							{ name: `Added members [${memberAdded.size}]:`, value: `${memberAddedString.length == 0 ? '*None*' : memberAddedString.join('\n ')}`, inline: true },
							{ name: `Removed member [${memberRemoved.size}]:`, value: `${memberRemovedString.length == 0 ? '*None*' : memberRemovedString.join('\n ')}`, inline: true })
						.setTimestamp();

					// Find channel and send message
					try {
						const modChannel = await bot.channels.fetch(logDB.ServerEvents.LogChannel).catch(() => {
							// do nothing.
						});
						if (modChannel && modChannel.guild.id == thread.guildId) bot.addEmbed(modChannel.id, [embed]);
					} catch (err) {
						bot.logger.error(`Event: '${this.conf.name}' has error: ${err.message}.`);
					}
				}
			}
		}
	}
};
