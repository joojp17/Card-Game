import { DiscordSDK } from "@discord/embedded-app-sdk";

export async function initializeDiscordSdk() {
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;

  if (!clientId || typeof window === "undefined" || !window.location.search.includes("frame_id")) {
    return { isDiscord: false };
  }

  const sdk = new DiscordSDK(clientId);
  await sdk.ready();

  return { isDiscord: true, sdk };
}
