import Component from 'flarum/common/Component';
import { isUnifiedMessagesRoute } from '../utils/messagingRoutes.js';

const BRAND_HREF = 'https://forum.flatrate.wiki';
const BRAND_TEXT = 'FlatRate.wiki';

/**
 * Centered FlatRate.wiki brand link for unified Messages routes only.
 */
export default class MessagesBrandLink extends Component {
  view() {
    if (!isUnifiedMessagesRoute()) {
      return null;
    }

    return (
      <a className="MessagesBrandLink" href={BRAND_HREF} aria-label={BRAND_TEXT}>
        {BRAND_TEXT}
      </a>
    );
  }
}

export { BRAND_HREF, BRAND_TEXT };
