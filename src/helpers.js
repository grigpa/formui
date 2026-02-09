/* helpers.js — small independent helpers */
(function (global) {
  'use strict';

  var FormUI = global.FormUI = global.FormUI || {};

  var env = FormUI.env || {};
  var rootEl = env.rootEl;
  var getByIdIn = env.getByIdIn;

  /**
   * enableEnterToSearch(container, btnId)
   *
   * При нажатии Enter в любом INPUT внутри container
   * кликает по кнопке btnId
   */
  function enableEnterToSearch(container, btnId) {
    var root = rootEl ? rootEl(container) : container;
    if (!root || !btnId) return;

    root.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT') {
        e.preventDefault();
        // accept "id" or "#id"
        var bid = (typeof btnId === 'string' && btnId.charAt(0) === '#') ? btnId.slice(1) : btnId;
        var btn = document.getElementById(bid);
        if (btn) btn.click();
      }
    });
  }

  FormUI.Helpers = FormUI.Helpers || {};
  FormUI.Helpers.enableEnterToSearch = enableEnterToSearch;

  // backward compat
  FormUI.enableEnterToSearch = enableEnterToSearch;


  /* =========================
   * Table adapter: QueryTable integration
   * ========================= */
  FormUI.Table = FormUI.Table || {};
  FormUI.Table.registry = FormUI.Table.registry || {};

  function walkFields(fields, fn) {
    (fields || []).forEach(function (f) {
      if (!f) return;
      fn(f);
      if (f.type === 'slot' && Array.isArray(f.fields)) {
        walkFields(f.fields, fn);
      }
    });
  }

  function findJspMountByScript(container, code) {
    if (!code) return null;

    var scriptId = 'queryTableRowCallbackScript_' + code;

    // If JSP is outside FormUI container, getByIdIn(container, ...) won't find it; fall back to document.
    var s = getByIdIn ? getByIdIn(container, scriptId) : null;
    if (!s) s = document.getElementById(scriptId);
    if (!s) return null;

    // JSP puts: <script id="..."></script> then a plain div without id
    var n = s.nextSibling;
    while (n) {
      if (n.nodeType === 1) { // element
        if (n.tagName === 'DIV') return n;
        // sometimes wrappers exist; accept first element div deeper
        var d = n.querySelector && n.querySelector('div');
        if (d) return d;
      }
      n = n.nextSibling;
    }

    return null;
  }

  function attachTables(container, fields, options) {
    options = options || {};
    if (typeof global.QueryTable !== 'function') return;

    walkFields(fields, function (field) {
      if (!field || field.type !== 'table' || !field.table) return;
      var jspParams = field.table.jspParams || {};
      var code = jspParams.queryTableCode;
      if (!code) return;

      // 1) Find JSP mount by script anchor anywhere in document (JSP is outside render root)
      var jspDiv = findJspMountByScript(document, code);
      if (!jspDiv) return;

      // 2) Find FormUI wrapper inside the render container
      var wrap = getByIdIn ? getByIdIn(container, field.id) : document.getElementById(field.id);
      if (!wrap) return;

      var mount = wrap.querySelector('.form-ui-table-mount');
      if (!mount) return;

      // 3) Always MOVE into FormUI grid (even if already initialized)
      var origParent = jspDiv.parentNode;
      var origNext = jspDiv.nextSibling;
      mount.appendChild(jspDiv);

      // 4) Registry record (persisted between renders)
      var rec = FormUI.Table.registry[code] || {};
      rec.code = code;
      rec.fieldId = field.id;
      rec.runtimeParams = rec.runtimeParams || null;
      rec.jspDiv = jspDiv;
      rec.origParent = origParent;
      rec.origNext = origNext;

      // 5) If already initialized - do not re-init DataTables
      //    (QueryTable internally calls $.fn.dataTable / $.fn.DataTable)
      var already = !!rec.initialized;

      // DataTables v1.10+ check (best effort)
      if (!already) {
        try {
          if (global.jQuery && global.jQuery.fn && global.jQuery.fn.DataTable) {
            var tableEl = document.getElementById('queryTable_' + code);
            if (tableEl && global.jQuery.fn.DataTable.isDataTable) {
              already = global.jQuery.fn.DataTable.isDataTable(tableEl);
            }
          }
        } catch (e) {
        }
      }

      if (already) {
        rec.initialized = true;
        FormUI.Table.registry[code] = rec;
        return;
      }
      // 6) First init
      var callbacks = field.table.callbacks || {};
      var originalDataFn = field.table.data || function () { return {}; };

      var wrappedDataFn = function () {
        var base = {};
        try {
          base = originalDataFn() || {};
        } catch (e) {
        }

        var extra = rec.runtimeParams;
        if (extra && typeof extra === 'object') {
          for (var k in extra) base[k] = extra[k];
        }

        return base;
      };
      var qtOptions = field.table.options || {};

      var inst = null;
      try {
        inst = new global.QueryTable(code, callbacks, wrappedDataFn, qtOptions);
      } catch (e) {
      }

      rec.instance = inst;
      rec.initialized = true;
      FormUI.Table.registry[code] = rec;
    });
  }


  function detachTables(container) {
    Object.keys(FormUI.Table.registry).forEach(function (code) {
      var rec = FormUI.Table.registry[code];
      if (!rec) return;

      // Do NOT destroy DataTables by default.
      // QueryTable / DataTables часто не поддерживают безопасную переинициализацию.
      // Мы просто возвращаем DOM на исходное место перед очисткой контейнера FormUI.
      try {
        if (rec.jspDiv && rec.origParent) {
          if (rec.origNext && rec.origNext.parentNode === rec.origParent) {
            rec.origParent.insertBefore(rec.jspDiv, rec.origNext);
          } else {
            rec.origParent.appendChild(rec.jspDiv);
          }
        }
      } catch (e) {
      }
      // registry запись НЕ удаляем, чтобы избежать повторной инициализации DataTables
      // (Cannot reinitialise DataTable)
      rec.instance = rec.instance || null;
      rec.initialized = !!rec.initialized;
      FormUI.Table.registry[code] = rec;
    });
  }

  FormUI.Table.attach = attachTables;
  FormUI.Table.detach = detachTables;


  /**
   * Table runtime API
   * - getTable(code) -> QueryTable instance|null
   * - reloadTable(code) -> boolean
   * - reloadTableByField(container, fieldId) -> boolean
   */
  function getTable(queryTableCode) {
    var reg = (FormUI.Table && FormUI.Table.registry) ? FormUI.Table.registry : null;
    if (!reg || !queryTableCode) return null;
    var rec = reg[queryTableCode];
    return (rec && rec.instance) ? rec.instance : null;
  }

  function reloadTable(queryTableCode, params) {
    var reg = FormUI.Table.registry;
    var rec = reg && reg[queryTableCode];
    if (!rec || !rec.instance || typeof rec.instance.reload !== 'function') {
      return false;
    }

    if (params && typeof params === 'object') {
      rec.runtimeParams = params;
    }

    try {
      rec.instance.reload();
      return true;
    } catch (e) {
      return false;
    }
  }

  function reloadTableByField(container, fieldId) {
    var reg = (FormUI.Table && FormUI.Table.registry) ? FormUI.Table.registry : null;
    if (!reg || !fieldId) return false;
    for (var code in reg) {
      if (!Object.prototype.hasOwnProperty.call(reg, code)) continue;
      var rec = reg[code];
      if (rec && rec.fieldId === fieldId) {
        if (rec.instance && typeof rec.instance.reload === 'function') {
          try {
            rec.instance.reload();
            return true;
          } catch (e) {
            return false;
          }
        }
        return false;
      }
    }
    return false;
  }

  FormUI.Table.get = getTable;
  FormUI.Table.reload = reloadTable;
  FormUI.Table.reloadByField = reloadTableByField;

  // top-level shortcuts (public)
  FormUI.getTable = FormUI.getTable || getTable;
  FormUI.reloadTable = FormUI.reloadTable || reloadTable;
  FormUI.reloadTableByField = FormUI.reloadTableByField || reloadTableByField;


  // backward compat aliases
  FormUI.attachTables = attachTables;
  FormUI.detachTables = detachTables;


  /* =========================
   * getEl / show / hide (runtime DOM)
   * ========================= */

  function _qs(root, sel) {
    return (root && root.querySelector) ? root.querySelector(sel) : null;
  }

  function _qsa(root, sel) {
    return (root && root.querySelectorAll) ? Array.prototype.slice.call(root.querySelectorAll(sel)) : [];
  }

  function _closestCol(el) {
    if (!el || !el.closest) return null;
    return el.closest('[class*="col-"]');
  }

  function _savePrevDisplay(el) {
    if (!el || !el.dataset) return;
    if (el.dataset.formuiPrevDisplay == null) {
      el.dataset.formuiPrevDisplay = (el.style && el.style.display != null) ? el.style.display : '';
    }
  }

  function _setDisplay(el, display) {
    if (!el) return;
    _savePrevDisplay(el);
    el.style.display = display;
  }

  function _restoreDisplay(el) {
    if (!el) return;
    if (el.dataset && el.dataset.formuiPrevDisplay != null) {
      el.style.display = el.dataset.formuiPrevDisplay;
      delete el.dataset.formuiPrevDisplay;
    } else {
      el.style.display = '';
    }
  }


  function _normId(id) {
    if (id == null) return '';
    if (typeof id !== 'string') return id;
    id = id.trim();
    if (!id) return '';
    return (id.charAt(0) === '#') ? id.slice(1) : id;
  }

  function _normContainer(container) {
    if (!container) return container;
    if (container.nodeType === 1) return container;
    if (typeof container !== 'string') return container;
    var sel = container.trim();
    if (!sel) return container;
    // if looks like plain id, convert to '#id'
    // do NOT touch complex selectors like '.a .b', 'div#x', '[data-x]'
    if (sel.charAt(0) !== '#' && /^[A-Za-z][\w\-:.]*$/.test(sel)) {
      sel = '#' + sel;
    }
    return sel;
  }

  /**
   * FormUI.getEl(container, id)
   * Возвращает структуру:
   * {
   *   id,
   *   kind: 'field'|'group'|'widget'|'unknown',
   *   root: HTMLElement|null,   // предпочтительный узел для hide/show (обычно bootstrap-col)
   *   col: HTMLElement|null,
   *   el: HTMLElement|null,     // узел с id (если найден)
   *   input: HTMLElement|null,  // input/select/textarea (если применимо)
   *   nodes: HTMLElement[],     // для radios/checkboxes по data-formui-group
   *   widget: HTMLElement|null  // для table (jsp div), если доступно (move)
   * }
   */

  function getEl(container, id) {
    container = _normContainer(container);
    var root = rootEl ? rootEl(container) : container;
    id = _normId(id);

    var res = {
      id: id,
      kind: 'unknown',
      root: null,
      col: null,
      el: null,
      input: null,
      nodes: [],
      widget: null
    };
    if (!id) return res;

    // 1) element by id inside container
    var el = getByIdIn ? getByIdIn(container, id) : null;
    if (el) {
      res.el = el;
      res.col = _closestCol(el);
      res.root = res.col || el;

      var tag = (el.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        res.kind = 'field';
        res.input = el;
      } else {
        res.kind = 'widget';
        res.input = _qs(el, 'input,select,textarea');

        // table wrapper: try to resolve moved jsp div via registry
        if (el.classList && el.classList.contains('form-ui-table')) {
          var reg = (FormUI.Table && FormUI.Table.registry) ? FormUI.Table.registry : null;
          if (reg) {
            Object.keys(reg).some(function (code) {
              var rec = reg[code];
              if (rec && rec.fieldId === id) {
                res.widget = rec.jspDiv || null;
                return true;
              }
              return false;
            });
          }
          // fallback: first div inside mount
          if (!res.widget) {
            var mount = _qs(el, '.form-ui-table-mount');
            res.widget = mount ? _qs(mount, 'div') : null;
          }
        }
      }

      return res;
    }

    // 2) radios/checkboxes group by data-formui-group inside container
    if (root) {
      var nodes = _qsa(root, '[data-formui-group="' + id + '"]');
      if (nodes.length) {
        res.kind = 'group';
        res.nodes = nodes;
        res.input = nodes[0];
        res.col = _closestCol(nodes[0]);
        res.root = res.col || nodes[0];
        return res;
      }
    }

    return res;
  }

  function hide(container, id, opts) {
    opts = opts || {};
    var r = getEl(container, id);
    if (!r.root) return r;

    if (opts.clearErrors && FormUI.Validation && typeof FormUI.Validation.clearFieldError === 'function') {
      try {
        FormUI.Validation.clearFieldError(container, id);
      } catch (e) {
      }
    }

    _setDisplay(r.root, 'none');
    return r;
  }

  function show(container, id) {
    var r = getEl(container, id);
    if (!r.root) return r;
    _restoreDisplay(r.root);

    return r;
  }

  function toggle(container, id, opts) {
    var r = getEl(container, id);
    if (!r.root) return r;

    var hidden = false;
    if (global.getComputedStyle) hidden = (getComputedStyle(r.root).display === 'none');
    else hidden = (r.root.style && r.root.style.display === 'none');

    return hidden ? show(container, id) : hide(container, id, opts);
  }

  function isVisible(container, id) {
    var r = getEl(container, id);
    if (!r.root) return false;
    if (global.getComputedStyle) return getComputedStyle(r.root).display !== 'none';
    return r.root.style.display !== 'none';
  }

  // export
  FormUI.Helpers.getEl = getEl;
  FormUI.Helpers.hide = hide;
  FormUI.Helpers.show = show;
  FormUI.Helpers.toggle = toggle;
  FormUI.Helpers.isVisible = isVisible;

  // top-level shortcuts (удобно)
  FormUI.getEl = getEl;
  FormUI.hide = hide;
  FormUI.show = show;
  FormUI.toggle = toggle;
  FormUI.isVisible = isVisible;

})(this);