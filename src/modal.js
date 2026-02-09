/* modal.js - FormUI.Modal (Bootstrap modal generator)
 * Requires: jQuery + Bootstrap modal plugin ($.fn.modal)
 */
(function (global) {
  'use strict';

  var FormUI = global.FormUI;
  if (!FormUI) return;

  FormUI.Modal = FormUI.Modal || {};

  function isObj(x){ return x && typeof x === 'object' && !Array.isArray(x); }

  function hasBootstrapModal() {
    return !!(global.jQuery && global.jQuery.fn && typeof global.jQuery.fn.modal === 'function');
  }

  function resolve(v, ctx) {
    return (typeof v === 'function') ? v(ctx || {}) : v;
  }

  function findMount(mount) {
    if (!mount || mount === 'body') return document.body;
    if (typeof mount === 'string') return document.querySelector(mount) || document.body;
    return mount;
  }

  function buildModal(cfg, ctx) {
    var id = cfg.modalId;

    var sizeClass =
      (cfg.size === 'lg') ? ' modal-lg' :
      (cfg.size === 'sm') ? ' modal-sm' : '';

    var backdrop = (cfg.backdrop != null) ? cfg.backdrop : true;
    var keyboard = (cfg.keyboard != null) ? cfg.keyboard : true;
    var showCloseX = (cfg.showCloseX !== false);

    var bodyCfg = cfg.body || {};
    var mountId = bodyCfg.mountId || (id + '_body');
    var asForm = (bodyCfg.asForm !== false);
    var formClass = bodyCfg.formClass || 'form-vertical';

    var bodyMountHtml = asForm
      ? '<form id="' + mountId + '" class="' + formClass + '" role="form"></form>'
      : '<div id="' + mountId + '"></div>';

    var closeBtnHtml = showCloseX
      ? '<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>'
      : '';

    var html =
      '<div id="' + id + '" class="modal fade" tabindex="-1" role="dialog" aria-hidden="true"' +
        ' data-backdrop="' + String(backdrop) + '"' +
        ' data-keyboard="' + String(keyboard) + '"' +
      '>' +
        '<div class="modal-dialog' + sizeClass + '">' +
          '<div class="modal-content">' +
            '<div class="modal-header">' +
              closeBtnHtml +
              '<h4 class="modal-title"></h4>' +
            '</div>' +
            '<div class="modal-body">' + bodyMountHtml + '</div>' +
            '<div class="modal-footer"></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.firstElementChild;
  }

  function buildFooter(modalEl, cfg, ctx) {
    var footerEl = modalEl.querySelector('.modal-footer');
    if (!footerEl) return;

    footerEl.innerHTML = '';
    var footer = cfg.footer || [];

    for (var i = 0; i < footer.length; i++) {
      var b = footer[i] || {};
      var btn = document.createElement('button');

      btn.type = b.type || 'button';
      btn.className = b.class || 'btn btn-default';
      if (b.id) btn.id = b.id;

      var text = resolve(b.text, ctx);
      btn.textContent = (text != null) ? String(text) : '';

      var attrs = b.attrs || {};
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        btn.setAttribute(k, String(attrs[k]));
      }

      if (typeof b.onClick === 'function') {
        (function (handler) {
          btn.addEventListener('click', function (e) { handler(e, modalEl, ctx); });
        })(b.onClick);
      }

      footerEl.appendChild(btn);
    }
  }

  // Generate fields from plain data object:
  // { a: '1', b: '2' } -> [{id:'a',name:'a',label:'a',type:'text'}, ...]
  function fieldsFromData(data, opts) {
    opts = opts || {};
    var out = [];
    if (!isObj(data)) return out;

    Object.keys(data).forEach(function (k) {
      if (opts.skip && opts.skip[k]) return;

      var base = {
        id: k,
        name: k,
        label: (opts.labels && opts.labels[k]) ? String(opts.labels[k]) : String(k),
        type: (opts.types && opts.types[k]) ? String(opts.types[k]) : 'text',
        attrs: (opts.attrs && opts.attrs[k]) ? opts.attrs[k] : null
      };

      // extra params per-field (validators, required, placeholder, inputClass, onChange, hidden, select2, etc)
      if (opts.extra && opts.extra[k] && typeof opts.extra[k] === 'object') {
        for (var ek in opts.extra[k]) {
          if (Object.prototype.hasOwnProperty.call(opts.extra[k], ek)) {
            base[ek] = opts.extra[k][ek];
          }
        }
      }

      out.push(base);
    });
    return out;
  }

  /**
   * Open (create/update + optional show) a bootstrap modal and render content inside it.
   *
   * cfg supports:
   *  - modalId, title, footer, body{mountId,asForm,formClass}, mount, size, backdrop, keyboard, showCloseX
   *  - show: boolean (default false)
   *  - renderFn(mountSel, ctx, modalEl)  // compat
   *  - bodyRender(mountSel, ctx, modalEl)
   *  - data: {field1:'111',...} + form: { fieldsOptions, layout, actions, renderOptions, breakpoint }
   */
  function openModal(cfg, ctx) {
    if (!cfg || !cfg.modalId) return null;

    ctx = ctx || global.JSP_CTX || {};

    var modalEl = document.getElementById(cfg.modalId);
    if (!modalEl) {
      modalEl = buildModal(cfg, ctx);
      findMount(cfg.mount).appendChild(modalEl);
    }

    // title
    var titleEl = modalEl.querySelector('.modal-title');
    var title = resolve(cfg.title, ctx);
    if (titleEl) titleEl.textContent = (title != null) ? String(title) : '';

    // footer
    buildFooter(modalEl, cfg, ctx);

    // render content
    var bodyCfg = cfg.body || {};
    var mountId = bodyCfg.mountId || (cfg.modalId + '_body');
    var mountSel = '#' + mountId;

    // decide renderer:
    // 1) data-mode -> generate fields + FormUI.render + FormUI.setValues
    // 2) explicit bodyRender/renderFn
    var bodyRender = cfg.bodyRender || cfg.renderFn;

    if (cfg.data && isObj(cfg.data)) {
      (function () {
        var form = cfg.form || {};
        var fieldsOptions = form.fieldsOptions || {};
        var genFields = fieldsFromData(cfg.data, fieldsOptions);

        var layout = (form.layout != null) ? form.layout : 1;
        var actions = Array.isArray(form.actions) ? form.actions : null;
        var renderOptions = form.renderOptions || {};
        var breakpoint = form.breakpoint || 'md';

        bodyRender = function (mountSel2) {
          if (!FormUI || typeof FormUI.render !== 'function') return;
          FormUI.render(mountSel2, genFields, layout, actions, renderOptions, breakpoint);
          if (typeof FormUI.setValues === 'function') {
            FormUI.setValues(mountSel2, cfg.data);
          }
        };
      })();
    }

    if (typeof bodyRender === 'function') {
      bodyRender(mountSel, ctx, modalEl);
    }

    // hooks once
    if (!modalEl.__formuiModalBound && hasBootstrapModal()) {
      modalEl.__formuiModalBound = true;

      global.jQuery(modalEl).on('shown.bs.modal', function () {
        if (typeof cfg.onOpen === 'function') {
          try { cfg.onOpen(modalEl, ctx); } catch (e) {}
        }
      });

      global.jQuery(modalEl).on('hidden.bs.modal', function () {
        if (typeof cfg.onClose === 'function') {
          try { cfg.onClose(modalEl, ctx); } catch (e) {}
        }
      });
    }

    // optional show
    if (cfg.show) {
      try { showModal(cfg.modalId); } catch (e2) {}
    }

    return modalEl;
  }

  // Backward-compatible wrappers
  function renderModal(cfg, renderFn, ctx) {
    cfg = cfg || {};
    var cfg2 = {};
    for (var k in cfg) if (Object.prototype.hasOwnProperty.call(cfg, k)) cfg2[k] = cfg[k];
    cfg2.show = false;
    cfg2.renderFn = renderFn;
    return openModal(cfg2, ctx);
  }

  function renderDataModal(cfg, data, formCfg, ctx) {
    cfg = cfg || {};
    var cfg2 = {};
    for (var k in cfg) if (Object.prototype.hasOwnProperty.call(cfg, k)) cfg2[k] = cfg[k];
    cfg2.show = false;
    cfg2.data = data || {};
    cfg2.form = formCfg || {};
    return openModal(cfg2, ctx);
  }

  function showDataModal(cfg, data, formCfg, ctx) {
    cfg = cfg || {};
    var cfg2 = {};
    for (var k in cfg) if (Object.prototype.hasOwnProperty.call(cfg, k)) cfg2[k] = cfg[k];
    cfg2.show = true;
    cfg2.data = data || {};
    cfg2.form = formCfg || {};
    return openModal(cfg2, ctx);
  }

  function showModal(modalId) {
    if (!hasBootstrapModal()) return false;
    var el = (typeof modalId === 'string') ? document.getElementById(modalId) : modalId;
    if (!el) return false;
    global.jQuery(el).modal('show');
    return true;
  }

  function hideModal(modalId) {
    if (!hasBootstrapModal()) return false;
    var el = (typeof modalId === 'string') ? document.getElementById(modalId) : modalId;
    if (!el) return false;
    global.jQuery(el).modal('hide');
    return true;
  }

  function destroyModal(modalId) {
    var el = (typeof modalId === 'string') ? document.getElementById(modalId) : modalId;
    if (!el) return false;
    try { if (hasBootstrapModal()) global.jQuery(el).modal('hide'); } catch (e) {}
    if (el.parentNode) el.parentNode.removeChild(el);
    return true;
  }

  // export
  FormUI.Modal.open = openModal;
  FormUI.Modal.render = renderModal;
  FormUI.Modal.show = showModal;
  FormUI.Modal.hide = hideModal;
  FormUI.Modal.destroy = destroyModal;
  FormUI.Modal.renderData = renderDataModal;
  FormUI.Modal.showData = showDataModal;

  // top-level shortcuts
  FormUI.openModal = FormUI.openModal || openModal;
  FormUI.renderModal = FormUI.renderModal || renderModal;
  FormUI.showModal = FormUI.showModal || showModal;
  FormUI.hideModal = FormUI.hideModal || hideModal;
  FormUI.destroyModal = FormUI.destroyModal || destroyModal;
  FormUI.renderDataModal = FormUI.renderDataModal || renderDataModal;
  FormUI.showDataModal = FormUI.showDataModal || showDataModal;

})(this);
