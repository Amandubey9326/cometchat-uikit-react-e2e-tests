import type { ChatUser } from '@fixtures/test.fixture';
import { expect } from '@fixtures/test.fixture';
import { uniqueText } from '@data/unique';
import { ASSETS } from '@pages/messages/MessageComposer';
import type { MessageType } from '@pages/messages/MessageList';
import type { SearchFilter } from '@pages/search/SearchPanel';

/** One searchable content type: how to send it and which filter / bubble type finds it. */
export interface MediaKind {
  label: string;
  filter: SearchFilter;
  bubble: MessageType;
  send: (user: ChatUser) => Promise<void>;
}

export const MEDIA: MediaKind[] = [
  { label: 'Audio', filter: 'audio', bubble: 'audio', send: u => u.app.composer.attach('audio', ASSETS.audio) },
  { label: 'Documents', filter: 'documents', bubble: 'file', send: u => u.app.composer.attach('file', ASSETS.pdf) },
  { label: 'Photos', filter: 'photos', bubble: 'image', send: u => u.app.composer.attach('image', ASSETS.image) },
  { label: 'Videos', filter: 'videos', bubble: 'video', send: u => u.app.composer.attach('video', ASSETS.video) },
  {
    label: 'Links',
    filter: 'links',
    bubble: 'text',
    send: u => u.app.sendAndConfirm(`${uniqueText('link')} https://www.wikipedia.org`),
  },
];

/** Sends `kind` in the open chat and waits until the server has it. */
export async function sendMedia(user: ChatUser, kind: MediaKind): Promise<void> {
  const before = await user.app.messages.ofType(kind.bubble).count();
  await kind.send(user);
  await expect(user.app.messages.ofType(kind.bubble)).toHaveCount(before + 1);
  await user.app.messages.bubbleOfType(kind.bubble, before).waitUntilSent();
}
