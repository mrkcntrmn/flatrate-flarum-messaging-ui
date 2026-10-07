import app from 'flarum/admin/app';

app.initializers.add('flatrate-messaging-ui', () => {
  app.extensionData
    .for('flatrate-messaging-ui')
    .registerSetting({
      setting: 'flatrate-messaging-ui.notifications_admin_preview_enabled',
      label: app.translator.trans('flatrate-messaging-ui.admin.settings.notifications_admin_preview_enabled'),
      help: app.translator.trans('flatrate-messaging-ui.admin.settings.notifications_admin_preview_enabled_help'),
      type: 'boolean',
    })
    .registerSetting({
      setting: 'flatrate-messaging-ui.notifications_member_beta_enabled',
      label: app.translator.trans('flatrate-messaging-ui.admin.settings.notifications_member_beta_enabled'),
      help: app.translator.trans('flatrate-messaging-ui.admin.settings.notifications_member_beta_enabled_help'),
      type: 'boolean',
    })
    .registerSetting({
      setting: 'flatrate-messaging-ui.notifications_member_enabled',
      label: app.translator.trans('flatrate-messaging-ui.admin.settings.notifications_member_enabled'),
      help: app.translator.trans('flatrate-messaging-ui.admin.settings.notifications_member_enabled_help'),
      type: 'boolean',
    });
});
