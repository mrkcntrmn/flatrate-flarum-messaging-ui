import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';

export default class MessagingEmptyState extends Component {
  view() {
    const oncompose = this.attrs.oncompose;

    return (
      <div className="MessagingEmptyState">
        <i className="icon fas fa-paper-plane MessagingEmptyState-icon" aria-hidden="true" />
        <h2 className="MessagingEmptyState-title">{app.translator.trans('flatrate-messaging-ui.forum.page.empty_title')}</h2>
        <p className="MessagingEmptyState-body">{app.translator.trans('flatrate-messaging-ui.forum.page.empty_body')}</p>
        {oncompose ? (
          <Button className="Button Button--primary" icon="fas fa-paper-plane" onclick={oncompose}>
            {app.translator.trans('flatrate-messaging-ui.forum.page.empty_cta')}
          </Button>
        ) : null}
      </div>
    );
  }
}
