'use strict';
'require view';
'require form';
'require fs';
'require ui';
'require poll';
'require tools.widgets as widgets';

return view.extend({
	load: function () {
		return fs.trimmed('/var/log/cddns.log').catch(function () { return ''; });
	},

	render: function (logdata) {
		var m, s, o;
		var lastLog = logdata || '';
		var logBox = null;

		var refreshLog = function () {
			return fs.trimmed('/var/log/cddns.log').then(function (res) {
				res = res || '';
				if (res !== lastLog && logBox) {
					var atBottom = logBox.scrollHeight - logBox.scrollTop - logBox.clientHeight < 20;
					lastLog = res;
					logBox.value = res || _('No log yet.');
					if (atBottom)
						logBox.scrollTop = logBox.scrollHeight;
				}
			}).catch(function () {});
		};

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

		var renderServices = s.render;
		s.render = function () {
			var section = this;

			return renderServices.apply(this, arguments).then(function (sectionEl) {
				var disabled = m.data.get('cddns', 'global', 'enabled') === '0';
				var btnUpdate = E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'type': 'button',
					'click': ui.createHandlerFn(section, function () {
						if (disabled) {
							ui.addNotification(null, E('p', _('CDDNS is disabled.')), 'danger');
							return Promise.resolve();
						}
						return fs.exec('/usr/bin/cddns', [ 'update' ]).then(function (res) {
							if (res && res.code !== 0)
								ui.addNotification(null, E('p', _('Update failed, please check the log.')), 'danger');
							else
								ui.addNotification(null, E('p', _('Update triggered.')), 'info');
							window.setTimeout(refreshLog, 1000);
						}).catch(function (e) {
							ui.addNotification(null, E('p', e.message), 'danger');
						});
					})
				}, [ _('Update Now') ]);
				if (disabled)
					btnUpdate.disabled = true;
				var title = sectionEl.firstElementChild;
				var header = E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between; gap:.5em; margin-bottom:.5em' });

				title.style.margin = '0';
				sectionEl.insertBefore(header, title);
				header.appendChild(title);
				header.appendChild(btnUpdate);

				return sectionEl;
			});
		};

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

		o = s.option(form.Value, 'subdomain', _('Subdomain'));
		o.placeholder = _('Leave empty for root record (@)');
		o.textvalue = function (section_id) {
			return this.cfgvalue(section_id) || '@';
		};

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

		o = s.option(widgets.NetworkSelect, 'iface', _('Interface'));
		o.depends('ip_source', 'iface');
		o.default = 'wan';
		o.nocreate = true;
		o.modalonly = true;

		o = s.option(form.Value, 'ip_url', _('IP Query URL'));
		o.depends('ip_source', 'url');
		o.placeholder = 'https://6.ipw.cn (IPv6) / https://4.ipw.cn (IPv4)';
		o.modalonly = true;

		o = s.option(form.Value, 'custom_ip', _('Custom IP'));
		o.depends('ip_source', 'custom');
		o.modalonly = true;

		o = s.option(form.Value, 'secret_id', _('SecretId / Token ID'));
		o.rmempty = false;
		o.modalonly = true;

		o = s.option(form.Value, 'secret_key', _('SecretKey / Token'));
		o.password = true;
		o.rmempty = false;
		o.modalonly = true;

		s = m.section(form.TypedSection, 'logview', _('CDDNS Log'));
		s.anonymous = true;
		s.cfgsections = function () { return [ 'logview' ]; };

		var renderLogSection = s.render;
		s.render = function () {
			var section = this;

			return renderLogSection.apply(this, arguments).then(function (sectionEl) {
				var btnClear = E('button', {
					'class': 'btn cbi-button cbi-button-negative',
					'type': 'button',
					'click': ui.createHandlerFn(section, function () {
						return fs.exec('/usr/bin/cddns', [ 'clearlog' ]).then(function () {
							lastLog = '';
							if (logBox) {
								logBox.value = _('No log yet.');
								logBox.scrollTop = 0;
							}
						}).catch(function (e) {
							ui.addNotification(null, E('p', e.message), 'danger');
						});
					})
				}, [ _('Clear Log') ]);
				var title = sectionEl.firstElementChild;
				var header = E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between; gap:.5em; margin-bottom:.5em' });

				title.style.margin = '0';
				sectionEl.insertBefore(header, title);
				header.appendChild(title);
				header.appendChild(btnClear);

				return sectionEl;
			});
		};

		o = s.option(form.DummyValue, '_logview');
		o.render = L.bind(function () {
			logBox = E('textarea', {
				'class': 'cbi-input-textarea',
				'readonly': 'readonly',
				'wrap': 'off',
				'rows': 20,
				'style': 'width:100%; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; line-height:1.45'
			});
			logBox.value = lastLog || _('No log yet.');

			return E('div', { 'style': 'width:100%' }, [ logBox ]);
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

		return m.render().then(L.bind(function (mapEl) {
			window.setTimeout(function () {
				if (logBox && lastLog)
					logBox.scrollTop = logBox.scrollHeight;
			}, 0);

			poll.add(function () {
				return document.hidden ? Promise.resolve() : refreshLog();
			}, 5);

			return mapEl;
		}, this));
	}
});
