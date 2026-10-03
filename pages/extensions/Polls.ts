import { expect, type Locator, type Page } from '@playwright/test';
import { t } from '@i18n/t';
import { escapeRegExp } from '@utils/text';

/**
 * UIKit CometChatCreatePoll — opened from the composer's attachment sheet ("Polls").
 * The "Question" / "Options" labels are not associated with their inputs (A11Y-011), so the
 * inputs are found by placeholder.
 */
export class CreatePollDialog {
  readonly dialog: Locator;
  readonly question: Locator;
  readonly options: Locator;
  readonly addOptionButton: Locator;
  readonly createButton: Locator;
  readonly closeButton: Locator;
  readonly error: Locator;

  constructor(readonly page: Page) {
    this.dialog = page.getByRole('dialog', { name: t('polls_title') });
    this.question = this.dialog.getByPlaceholder(t('polls_question_placeholder'));
    this.options = this.dialog.getByPlaceholder(t('polls_add_placeholder'), { exact: true });
    this.addOptionButton = this.dialog.getByRole('button', { name: new RegExp(escapeRegExp(t('polls_add_option_button'))) });
    this.createButton = this.dialog.getByRole('button', { name: t('polls_create_button'), exact: true });
    this.closeButton = this.dialog.getByRole('button', { name: t('accessibility_close') });
    this.error = this.dialog.getByRole('alert');
  }

  async fill(question: string, answers: string[]): Promise<void> {
    await this.question.fill(question);
    for (let i = 0; i < answers.length; i++) {
      if (i >= (await this.options.count())) await this.addOptionButton.click();
      await this.options.nth(i).fill(answers[i]);
    }
  }

  async create(question: string, answers: string[]): Promise<void> {
    await this.fill(question, answers);
    await this.createButton.click();
    await expect(this.dialog).toBeHidden();
  }
}

/** A poll message: `group "Poll: <question>"` with one `radio` per answer. */
export class PollBubble {
  readonly root: Locator;

  constructor(
    readonly scope: Locator,
    readonly question: string
  ) {
    this.root = scope.getByRole('group', { name: t('accessibility_poll_question').replace('{question}', question) });
  }

  /** Answer as a radio, labelled "<text>, <n> votes, <pct>". */
  option(text: string): Locator {
    return this.root.getByRole('radio', { name: new RegExp(`^${escapeRegExp(text)}, `) });
  }

  /** Accessible-name pattern for an answer with `count` votes. */
  static votes(text: string, count: number): RegExp {
    return new RegExp(`^${escapeRegExp(text)}, ${escapeRegExp(t('accessibility_vote_count').replace('{count}', String(count)))}, `);
  }
}
