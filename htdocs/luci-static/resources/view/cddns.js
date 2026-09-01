'use strict';
'require view';
'require form';
'require fs';
'require dom';
'require ui';
'require poll';

return view.extend({
	load: function () {
		return fs.trimmed('/var/log/cddns.log').catch(function () { return ''; });
	},

	render: function (logdata) {
		var m, s, o;
		var lastLog = logdata || '';
		var logBox = null;

		m = new form.Map('cddns', _('CDDNS'),
			_('Dynamic DNS client for Tencent Cloud (DNSPod / DNSPod Token) and Alibaba Cloud (Alidns).'));

		s = m.section(form.NamedSection, 'global', 'cddns', _('Global Settings'));
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.ListValue, 'interval', _('Update Interval (minutes)'));
		o.value('5');
		o.value('10');
		o.value('15');
		o.value('20');
		o.value('30');
		o.value('60');
		o.default = '15';

		o = s.option(form.Value, 'log_lines', _('Log Lines to Keep'));
		o.datatype = 'min(10)';
		o.default = '200';

		s = m.section(form.GridSection, 'service', _('DDNS Services'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;
		s.nodescriptions = true;

		// cap the number of DDNS services the UI allows
		var maxServices = 5;
		var origHandleAdd = s.handleAdd;
		s.handleAdd = function (ev) {
			if (this.cfgsections().length >= maxServices) {
				ui.addNotification(null, E('p', _('At most %d DDNS services are allowed.').format(maxServices)), 'info');
				return;
			}
			if (typeof origHandleAdd === 'function')
				return origHandleAdd.call(this, ev);
		};

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '1';
		o.rmempty = false;
		o.editable = true;

		o = s.option(form.ListValue, 'provider', _('Provider'));
		o.value('tencent', _('Tencent Cloud (DNSPod)'));
		o.value('aliyun', _('Alibaba Cloud (Alidns)'));

		o = s.option(form.Value, 'domain', _('Domain'));
		o.placeholder = 'example.com';
		o.rmempty = false;
		o.editable = true;

		o = s.option(form.Value, 'subdomain', _('Subdomain'));
		o.placeholder = _('Leave empty for root record (@)');
		o.editable = true;

		o = s.option(form.ListValue, 'record_type', _('Record Type'));
		o.value('A', _('A (IPv4)'));
		o.value('AAAA', _('AAAA (IPv6)'));
		o.default = 'A';

		o = s.option(form.ListValue, 'ip_source', _('IP Source'));
		o.value('iface', _('Network Interface'));
		o.value('url', _('URL'));
		o.value('custom', _('Custom'));
		o.default = 'iface';
		o.modalonly = true;

		o = s.option(form.Value, 'iface', _('Interface'));
		o.depends('ip_source', 'iface');
		o.default = 'wan';
		o.modalonly = true;

		o = s.option(form.Value, 'ip_url', _('IP Query URL'));
		o.depends('ip_source', 'url');
		o.placeholder = 'https://6.ipw.cn (IPv6) / https://4.ipw.cn (IPv4)';
		o.modalonly = true;

		o = s.option(form.Value, 'custom_ip', _('Custom IP'));
		o.depends('ip_source', 'custom');
		o.modalonly = true;

		o = s.option(form.Value, 'secret_id', _('SecretId / Token ID'));
		o.placeholder = _('CAM SecretId (AKIDxxx) or DNSPod Token ID (numeric)');
		o.rmempty = false;
		o.modalonly = true;

		o = s.option(form.Value, 'secret_key', _('SecretKey / Token'));
		o.password = true;
		o.placeholder = _('CAM SecretKey or DNSPod Token value');
		o.rmempty = false;
		o.modalonly = true;

		s = m.section(form.TypedSection, 'logview', _('CDDNS Log'));
		s.anonymous = true;
		s.hidetitle = true;
		s.cfgsections = function () { return [ 'logview' ]; };

		o = s.option(form.DummyValue, '_logview');
		o.render = L.bind(function () {
			var globalEnabled = m.data ? m.data.get('cddns', 'global', 'enabled') : '1';
			var disabled = (globalEnabled === '0');
			var logCss = [
				'#cddns_log { padding:10px; text-align:left; height:320px; overflow:auto; box-sizing:border-box; }',
				'#cddns_log pre { padding:.5rem; word-break:break-all; margin:0; min-height:100%; box-sizing:border-box; }'
			].join('\n');

			logBox = E('div', { 'id': 'cddns_log' }, [
				E('pre', { 'wrap': 'pre' }, [ lastLog || _('No log yet.') ])
			]);

			var btnUpdate = E('button', {
				'class': 'btn cbi-button cbi-button-apply',
				'style': 'margin-left:4px',
				'click': ui.createHandlerFn(this, function () {
					if (disabled) {
						ui.addNotification(null, E('p', _('CDDNS is disabled.')), 'error');
						return Promise.resolve();
					}
					return fs.exec('/usr/bin/cddns', [ 'update' ]).then(function () {
						ui.addNotification(null, E('p', _('Update triggered.')), 'info');
					}).catch(function (e) {
						ui.addNotification(null, E('p', e.message), 'error');
					});
				})
			}, [ _('Update Now') ]);
			if (disabled)
				btnUpdate.disabled = true;

			var btnClear = E('button', {
				'class': 'btn',
				'style': 'margin-left:4px',
				'click': ui.createHandlerFn(this, function () {
					return fs.exec('/usr/bin/cddns', [ 'clearlog' ]).then(function () {
						lastLog = '';
						if (logBox) {
							dom.content(logBox, E('pre', { 'wrap': 'pre' }, [ _('No log yet.') ]));
							logBox.scrollTop = 0;
						}
					});
				})
			}, [ _('Clear Log') ]);

			return E('div', { 'style': 'width:100%' }, [
				E('style', [ logCss ]),
				E('h3', { 'style': 'align-items:center; display:flex;' }, [ _('CDDNS Log'), btnUpdate, btnClear ]),
				logBox,
				E('div', { 'style': 'text-align:right' },
					E('small', {}, _('Refresh every %s seconds.').format(5)))
			]);
		}, this);

		var mapParse = m.parse;
		m.parse = function () {
			return mapParse.call(this).then(L.bind(function () {
				var data = this.data;
				var globalEnabled = data.get('cddns', 'global', 'enabled');
				var services = data.sections('cddns', 'service');
				var anyEnabled = services.some(function (svc) {
					return svc.enabled != '0';
				});

				if (globalEnabled != '0' && !anyEnabled)
					return Promise.reject(new TypeError(_('Please enable at least one DDNS service.')));
			}, this));
		};

		// restart right after save so cron re-syncs
		var mapSave = m.save;
		m.save = function (cb, silent) {
			return mapSave.call(this, cb, silent).then(function () {
				return fs.exec('/etc/init.d/cddns', [ 'restart' ]).catch(function (e) {
					ui.addNotification(null, E('p', _('Failed to restart CDDNS: %s').format(e.message)), 'error');
				});
			});
		};

		return m.render().then(L.bind(function (mapEl) {
			poll.add(L.bind(function () {
				return fs.trimmed('/var/log/cddns.log').then(function (res) {
					res = res || '';
					if (res !== lastLog && logBox) {
						lastLog = res;
						dom.content(logBox, E('pre', { 'wrap': 'pre' }, [ res || _('No log yet.') ]));
						logBox.scrollTop = logBox.scrollHeight;
					}
				}).catch(function () {});
			}, this), 5);

			return mapEl;
		}, this));
	}
});
