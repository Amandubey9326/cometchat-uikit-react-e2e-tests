import { expect, type Page } from '@playwright/test';
import type { TestUser } from '@data/personas';
import { withRealtimeConnected } from '@utils/realtime';
import { ConversationList } from './conversations/ConversationList';
import { GroupsList } from './groups/GroupsList';
import { HomePage } from './home/HomePage';
import { MessageComposer } from './messages/MessageComposer';
import { MessageHeader } from './messages/MessageHeader';
import { MessageList } from './messages/MessageList';
import { EmojiKeyboard } from './components/EmojiKeyboard';
import { GroupDetails, UserDetails } from './details/DetailsPanel';
import { ThreadPanel } from './threads/ThreadPanel';
import { UsersList } from './users/UsersList';

/** Everything one signed-in user sees, composed from component page objects. */
export class ChatApp {
  readonly home: HomePage;
  readonly conversations: ConversationList;
  readonly users: UsersList;
  readonly groups: GroupsList;
  readonly header: MessageHeader;
  readonly messages: MessageList;
  readonly composer: MessageComposer;
  readonly thread: ThreadPanel;
  readonly emojiKeyboard: EmojiKeyboard;
  readonly userDetails: UserDetails;
  readonly groupDetails: GroupDetails;

  constructor(readonly page: Page) {
    // The main chat lives in the sample app's messages wrapper; the thread panel has its own list + composer.
    const main = page.locator('.cometchat-messages-wrapper');
    this.home = new HomePage(page);
    this.conversations = new ConversationList(page);
    this.users = new UsersList(page);
    this.groups = new GroupsList(page);
    this.header = new MessageHeader(page);
    this.messages = new MessageList(page, main);
    this.composer = new MessageComposer(page, main.locator('.cometchat-composer-wrapper'));
    this.thread = new ThreadPanel(page);
    this.emojiKeyboard = new EmojiKeyboard(page);
    this.userDetails = new UserDetails(page);
    this.groupDetails = new GroupDetails(page);
  }

  /** Loads the app with a saved session; ready = Chats loaded and realtime connected. */
  async open(): Promise<void> {
    await withRealtimeConnected(this.page, () => this.page.goto('/'));
    await this.home.waitForReady();
  }

  /** Reloads the page; ready = Chats loaded and realtime connected. */
  async reload(): Promise<void> {
    await withRealtimeConnected(this.page, () => this.page.reload());
    await this.home.waitForReady();
  }

  /**
   * Opens a 1:1 chat through the Users tab (works even with no prior conversation).
   * `composer: false` for chats that have none (e.g. with a blocked user).
   */
  async openChatWith(user: TestUser, { composer = true }: { composer?: boolean } = {}): Promise<void> {
    await this.home.openTab('users');
    await this.users.search(user.name);
    await this.users.item(user.name).click();
    await expect(this.header.titleFor(user.name)).toBeVisible();
    if (composer) await expect(this.composer.input).toBeVisible();
  }

  /**
   * Sends `text` in the open chat and waits until the server acknowledged it.
   * The composer ignores Enter while a previous message is still "Sending", so
   * tests that send several messages in a row use this.
   */
  async sendAndConfirm(text: string): Promise<void> {
    await this.composer.sendWithEnter(text);
    const bubble = this.messages.message(text);
    await expect(bubble.root).toBeVisible();
    await expect(bubble.receipt('sending')).toHaveCount(0);
  }

  /** Opens a group chat through the Groups tab. */
  async openGroup(name: string): Promise<void> {
    await this.home.openTab('groups');
    await this.groups.search(name);
    await this.groups.item(name).click();
    await expect(this.header.titleFor(name)).toBeVisible();
  }

  /** Opens the details panel of the open chat (User Info / Group Info). */
  async openDetails(): Promise<void> {
    await this.header.detailsButton.click();
    await expect(this.userDetails.headerText).toBeVisible();
  }

  /** Opens an existing conversation from the Chats tab. */
  async openConversation(name: string): Promise<void> {
    await this.home.openTab('chats');
    await this.conversations.open(name);
    await expect(this.header.titleFor(name)).toBeVisible();
  }
}
