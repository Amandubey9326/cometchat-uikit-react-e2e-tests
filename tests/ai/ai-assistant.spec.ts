import type { Locator } from '@playwright/test';
import { AI_AGENTS } from '@data/agents';
import type { TestUser } from '@data/personas';
import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { AIAssistantChat } from '@pages/ai/AIAssistantChat';
import type { ChatApp } from '@pages/ChatApp';
import type { CometChatApi } from '@api/cometchat-api';
import { startsWithWord } from '@utils/text';

const REPLY_TIMEOUT = 90_000;

async function agent(api: CometChatApi, index: number): Promise<TestUser> {
  const uid = AI_AGENTS[index];
  const user = await api.users.get(uid);
  if (!user) throw new Error(`AI agent "${uid}" (from .env) does not exist on this app`);
  return { uid: user.uid, name: user.name };
}

/** Opens the agent from the Users tab; the app renders the AI Assistant instead of the normal chat. */
async function openAgent(app: ChatApp, agentUser: TestUser): Promise<AIAssistantChat> {
  await app.home.openTab('users');
  await app.users.search(agentUser.name);
  await app.users.item(agentUser.name).click();
  const ai = new AIAssistantChat(app.page);
  await ai.expectOpen();
  return ai;
}

/** Completed agent replies in a group chat, by agent. */
function agentReplies(app: ChatApp, agentUser: TestUser): Locator {
  return app.messages.messages
    .filter({ has: app.page.locator('.cometchat-ai-assistant-bubble__content') })
    .and(app.messages.log.getByRole('article', { name: startsWithWord(agentUser.name) }));
}

test.describe('AI Assistant', { tag: ['@ai', '@regression'] }, () => {
  test.describe.configure({ timeout: 240_000 });

  test('AI-01 the assistant greets, streams a reply, keeps it in history and starts a new chat', async ({ data, api, loginAs }) => {
    test.skip(AI_AGENTS.length < 1, 'Set AI_AGENT_UID in .env (an @agentic user from AI → Agent Builder)');
    const bot = await agent(api, 0);
    const me = await data.user('asker');
    const { app } = await loginAs(me);

    const ai = await openAgent(app, bot);

    // Greeting — the empty state shows the agent's greeting and composer is ready.
    await expect(ai.emptyState).toBeVisible();
    await expect(ai.greeting).not.toBeEmpty();
    await expect(ai.sendButton).toBeVisible();

    // Send → the question shows, "Stop generating" while streaming, then a non-empty reply.
    const question = uniqueText('Please answer in one short sentence: what is a chat app');
    await ai.ask(question);
    await expect(ai.question(question)).toBeVisible();
    await expect(ai.emptyState).toBeHidden();
    await ai.waitForReply(1, REPLY_TIMEOUT);

    // History — the conversation is listed and opens again with its question.
    await ai.historyButton.click();
    await expect(ai.historyButton).toHaveAttribute('aria-expanded', 'true');
    await expect(ai.historyItems.first()).toBeVisible({ timeout: 30_000 });

    // New chat — back to the greeting with an empty list.
    await ai.closeHistoryButton.click();
    await ai.newChatButton.click();
    await expect(ai.emptyState).toBeVisible();
    await expect(ai.question(question)).toHaveCount(0);

    await ai.historyButton.click();
    await ai.historyItems.first().click();
    await expect(ai.question(question)).toBeVisible();
    await expect(ai.replies.first()).not.toBeEmpty();
  });

  test('AI-01b a suggested prompt fills the composer', async ({ data, api, loginAs }) => {
    test.skip(AI_AGENTS.length < 1, 'Set AI_AGENT_UID in .env');
    const bot = await agent(api, 0);
    const me = await data.user('prompter');
    const { app } = await loginAs(me);
    const ai = await openAgent(app, bot);
    test.skip((await ai.suggestions.count()) === 0, 'This agent has no suggested messages configured');

    const suggestion = (await ai.suggestions.first().innerText()).trim();
    await ai.suggestions.first().click();

    await expect(ai.input).toContainText(suggestion);
  });

  test('AI-02 a solo agent in a group answers every message', async ({ data, api, loginAs }) => {
    test.skip(AI_AGENTS.length < 1, 'Set AI_AGENT_UID in .env');
    const bot = await agent(api, 0);
    const me = await data.user('member');
    const group = await data.group({ owner: me, participants: [bot] });
    const { app } = await loginAs(me);
    await app.openGroup(group.name);

    await app.sendAndConfirm(uniqueText('Hello agent, please reply with one short sentence'));

    await expect(agentReplies(app, bot)).toHaveCount(1, { timeout: REPLY_TIMEOUT });
    await expect(agentReplies(app, bot).locator('.cometchat-ai-assistant-bubble__content')).not.toBeEmpty();
  });

  test('AI-02b with two agents in a group, only the mentioned agent answers', async ({ data, api, loginAs }) => {
    test.skip(AI_AGENTS.length < 2, 'Set AI_AGENT_UID and AI_AGENT_2_UID in .env');
    const [first, second] = [await agent(api, 0), await agent(api, 1)];
    const me = await data.user('squad');
    const group = await data.group({ owner: me, participants: [first, second] });
    const { app } = await loginAs(me);
    await app.openGroup(group.name);

    // A message that mentions nobody, then one that mentions the second agent. A wrong answer to the
    // first message would arrive no later than the right answer to the second, so once the second
    // agent has answered, the counts below are final.
    await app.sendAndConfirm(uniqueText('This message mentions nobody'));
    const composer = app.composer;
    await composer.type(`${uniqueText('Please reply in one sentence')} @${second.name.split(' ')[0]}`);
    await composer.mentionSuggestions.getByRole('option', { name: startsWithWord(second.name) }).click();
    await composer.sendButton.click();

    await expect(agentReplies(app, second)).toHaveCount(1, { timeout: REPLY_TIMEOUT });
    await expect(agentReplies(app, first)).toHaveCount(0);
  });
});
