/**
 * Slack file download — golden rule #10 (AGENTS.md): url_private requires
 * Authorization: Bearer <BotToken>; an anonymous fetch 404s.
 */
export async function downloadSlackFile(urlPrivate: string, botToken: string): Promise<Buffer> {
  const res = await fetch(urlPrivate, { headers: { Authorization: `Bearer ${botToken}` } });
  if (!res.ok) {
    throw new Error(`downloadSlackFile: ${res.status} ${res.statusText} fetching ${urlPrivate}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
