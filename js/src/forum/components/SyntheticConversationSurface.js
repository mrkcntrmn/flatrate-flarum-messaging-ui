import Component from 'flarum/common/Component';
import {
  buildSyntheticMessages,
  SYNTHETIC_MESSAGE_COUNTS,
} from '../fixtures/syntheticMessagingFixtures.js';
import {
  isNearBottom,
  shouldAutoScrollIncoming,
  shouldInitialScroll,
  scrollToLatest,
  calculatePreservedScrollTop,
} from '../utils/messageScroll.js';

/**
 * Disposable V2 surface used to prove shell viewport ownership with large histories.
 * Not used in production provider paths.
 */
export default class SyntheticConversationSurface extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    const count = normalizeCount(this.attrs.messageCount);
    this.kind = this.attrs.kind === 'live' ? 'live' : 'direct';
    this.messages = buildSyntheticMessages(count, { kind: this.kind, seed: this.attrs.seed || 'shell' });
    this.hasInitialPositioned = false;
    this.currentConversationKey = this.attrs.conversationKey || `${this.kind}:synthetic`;
    this.pendingNew = false;
    this.viewportEl = null;
  }

  oncreate(vnode) {
    super.oncreate(vnode);
    this.captureViewport(vnode);
    this.maybeInitialScroll();
  }

  onupdate(vnode) {
    super.onupdate(vnode);
    this.captureViewport(vnode);
    this.maybeInitialScroll();
  }

  captureViewport(vnode) {
    this.viewportEl = vnode.dom && vnode.dom.querySelector('.MessagesMessageViewport');
  }

  maybeInitialScroll() {
    const key = this.attrs.conversationKey || this.currentConversationKey;
    if (
      shouldInitialScroll({
        hasInitialPositioned: this.hasInitialPositioned,
        conversationKey: key,
        currentConversationKey: this.currentConversationKey,
        hasRenderedMessages: this.messages.length > 0,
      })
    ) {
      this.currentConversationKey = key;
      this.hasInitialPositioned = false;
    }

    if (
      !this.hasInitialPositioned &&
      this.messages.length > 0 &&
      this.viewportEl
    ) {
      requestAnimationFrame(() => {
        scrollToLatest(this.viewportEl);
        this.hasInitialPositioned = true;
        m.redraw();
      });
    }
  }

  view() {
    const count = this.messages.length;

    return (
      <div className={'MessagesDirectSurface MessagesSyntheticSurface' + (this.kind === 'live' ? ' MessagesLiveSurface' : '')}>
        <div
          className="MessagesMessageViewport"
          data-message-count={count}
          onscroll={() => {
            /* scroll owner is this viewport only */
          }}
        >
          <div className="MessagesSyntheticSurface-list" role="log" aria-live="polite">
            {this.messages.map((message) => (
              <div
                key={message.id}
                className={
                  'MessagesSyntheticBubble' +
                  (message.outgoing ? ' MessagesSyntheticBubble--out' : ' MessagesSyntheticBubble--in')
                }
              >
                <div className="MessagesSyntheticBubble-meta">
                  {message.author}
                  <span aria-hidden="true"> · </span>
                  {message.createdAt}
                </div>
                <div className="MessagesSyntheticBubble-body">{message.body}</div>
              </div>
            ))}
          </div>
        </div>
        {this.pendingNew ? (
          <button
            type="button"
            className="Button MessagesJumpToLatest"
            onclick={() => this.jumpToLatest()}
          >
            New messages
          </button>
        ) : null}
        <div className="MessagesComposer">
          <textarea
            className="FormControl MessagesComposer-input"
            rows="1"
            placeholder="Type a message…"
            aria-label="Type a message"
            disabled
          />
          <button type="button" className="Button Button--primary MessagesComposer-send" disabled>
            Send
          </button>
        </div>
      </div>
    );
  }

  jumpToLatest() {
    scrollToLatest(this.viewportEl);
    this.pendingNew = false;
  }

  /**
   * Qualification helpers (callable from console / tests).
   */
  simulateIncoming() {
    const nearBottom = isNearBottom(this.viewportEl);
    const next = {
      id: `incoming-${this.messages.length + 1}`,
      body: `Incoming synthetic ${this.messages.length + 1}`,
      outgoing: false,
      author: 'peer',
      createdAt: new Date().toISOString(),
    };
    this.messages = this.messages.concat([next]);
    if (shouldAutoScrollIncoming({ nearBottom, isOwnSend: false, hasInitialPositioned: this.hasInitialPositioned })) {
      requestAnimationFrame(() => scrollToLatest(this.viewportEl));
      this.pendingNew = false;
    } else {
      this.pendingNew = true;
    }
  }

  simulatePrependOlder(batchSize = 20) {
    if (!this.viewportEl) return;
    const oldHeight = this.viewportEl.scrollHeight;
    const oldTop = this.viewportEl.scrollTop;
    const older = buildSyntheticMessages(batchSize, {
      kind: this.kind,
      seed: `older-${this.messages.length}`,
    }).map((message, index) => ({
      ...message,
      id: `older-${this.messages.length}-${index}`,
      body: `Older synthetic ${index + 1}`,
    }));
    this.messages = older.concat(this.messages);
    m.redraw.sync();
    const newHeight = this.viewportEl.scrollHeight;
    this.viewportEl.scrollTop = calculatePreservedScrollTop(oldHeight, oldTop, newHeight);
  }
}

function normalizeCount(value) {
  const n = Number(value);
  if (SYNTHETIC_MESSAGE_COUNTS.includes(n)) {
    return n;
  }
  if (Number.isFinite(n) && n > 0) {
    return Math.min(Math.floor(n), 500);
  }
  return 200;
}

export { SYNTHETIC_MESSAGE_COUNTS };
