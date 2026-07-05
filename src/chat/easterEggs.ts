/**
 * Checked before the chat loop ever calls the model — a fixed, free, instant
 * reply for a couple of fun asks. Not part of PRD scope; Katty asked the bot
 * "will you be my friend" for fun during the build, so it earned a real answer
 * instead of falling through to the LLM.
 */
const FRIEND_REGEX = /\bwill you be my friend\b/i;

export function matchEasterEgg(text: string): string | undefined {
  if (FRIEND_REGEX.test(text)) {
    return "Yes :) already have you on my very short list.";
  }
  return undefined;
}
