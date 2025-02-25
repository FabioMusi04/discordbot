import { REST, Routes } from "discord.js";
import { ticketCommands } from "../tickets/commands";
import { membershipCommands } from "../membership/commands";
import config from "../config";

const commands = [ticketCommands.toJSON(), ...membershipCommands.map((c) => c.toJSON())];
const rest = new REST().setToken(config.discordToken);

(async () => {
  try {
    console.log("Refreshing slash commands...");
    await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.guildId), {
      body: commands,
    });
    console.log("Commands registered!");
  } catch (error) {
    console.error(error);
  }
})();
