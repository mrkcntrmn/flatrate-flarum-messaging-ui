import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';

const FILTERS = ['all', 'unread', 'direct', 'live'];

export default class MessagingFilters extends Component {
  view() {
    const current = this.attrs.filter || 'all';
    const available = this.attrs.available || FILTERS;

    return (
      <div className="MessagingFilters" role="tablist" aria-label={app.translator.trans('flatrate-messaging-ui.forum.page.title')}>
        {FILTERS.filter((name) => available.includes(name)).map((name) => (
          <Button
            className={'Button MessagingFilters-button' + (current === name ? ' Button--primary' : '')}
            onclick={() => this.attrs.onchange && this.attrs.onchange(name)}
            aria-pressed={current === name ? 'true' : 'false'}
          >
            {app.translator.trans(`flatrate-messaging-ui.forum.filters.${name}`)}
          </Button>
        ))}
      </div>
    );
  }
}
