import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveForumNotificationTarget } from '../src/forum/notifications/forumNotificationTarget.js';

function component(href) {
  function NotificationComponent() {}
  NotificationComponent.prototype.href = href;
  return NotificationComponent;
}

function model({ type, subject, content }) {
  return {
    contentType: () => type,
    subject: () => subject,
    content: () => content,
  };
}

const app = {
  notificationComponents: {
    newPost: component(function replyHref() {
      const discussion = this.attrs.notification.subject();
      const content = this.attrs.notification.content() || {};
      if (!discussion) return '#';
      return `/d/${discussion.slug()}/${content.postNumber}`;
    }),
    userMentioned: component(function mentionHref() {
      const post = this.attrs.notification.subject();
      return `/d/${post.discussion().slug()}/${post.number()}`;
    }),
    postLiked: component(function likeHref() {
      const post = this.attrs.notification.subject();
      return `/d/${post.discussion().slug()}/${post.number()}`;
    }),
  },
};

test('forum reply, mention, and like targets come from the component href', () => {
  const reply = resolveForumNotificationTarget(app, model({
    type: 'newPost',
    subject: { slug: () => '12-compressor' },
    content: { postNumber: 4 },
  }));
  assert.deepEqual(reply, { href: '/d/12-compressor/4', unavailable: false });

  const mention = resolveForumNotificationTarget(app, model({
    type: 'userMentioned',
    subject: { discussion: () => ({ slug: () => '9-mention' }), number: () => 2 },
    content: {},
  }));
  assert.equal(mention.href, '/d/9-mention/2');

  const like = resolveForumNotificationTarget(app, model({
    type: 'postLiked',
    subject: { discussion: () => ({ slug: () => '3-liked' }), number: () => 8 },
    content: {},
  }));
  assert.equal(like.href, '/d/3-liked/8');
});

test('a missing subject does not invent a discussion url', () => {
  const missing = resolveForumNotificationTarget(app, model({
    type: 'newPost',
    subject: null,
    content: { postNumber: 1 },
  }));
  assert.deepEqual(missing, { href: '', unavailable: true });

  const thrown = resolveForumNotificationTarget(app, model({
    type: 'postLiked',
    subject: null,
    content: {},
  }));
  assert.deepEqual(thrown, { href: '', unavailable: true });

  const unknown = resolveForumNotificationTarget(app, model({
    type: 'userSuspended',
    subject: { slug: () => '1-nope' },
    content: {},
  }));
  assert.deepEqual(unknown, { href: '', unavailable: true });
});
