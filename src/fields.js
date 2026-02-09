/* fields.js — flattenFields + Controls + createAjaxSelect */
(function (global) {
  'use strict';

  var FormUI = global.FormUI = global.FormUI || {};

  // deps
  var utils = FormUI.utils || {};
  var dom = FormUI.dom || {};
  var h = dom.h;

  // fallbacks (если utils/dom ещё не подключены — лучше подключать core.js раньше)
  function isObj(x) {
    return x && typeof x === 'object' && !Array.isArray(x) && !x.nodeType;
  }

  function merge(a, b) {
    a = a || {};
    b = b || {};
    var o = {};
    Object.keys(a).forEach(function (k) {
      o[k] = a[k]
    });
    Object.keys(b).forEach(function (k) {
      o[k] = b[k]
    });
    return o;
  }

  function cls(a, b) {
    if (!a) return b || '';
    if (!b) return a;
    return a + ' ' + b;
  }

  var _isObj = utils.isObj || isObj;
  var _merge = utils.merge || merge;
  var _cls = utils.cls || cls;

  // Local tag helpers: prefer global DIV/INPUT... (если включены), иначе через dom.h
  function TAG(name) {
    return function () {
      if (typeof global[name.toUpperCase()] === 'function') {
        return global[name.toUpperCase()].apply(null, arguments);
      }
      if (!h) throw new Error('FormUI.dom.h is required (load core.js before fields.js)');
      return h.apply(null, [name].concat([].slice.call(arguments)));
    };
  }

  var DIV = TAG('div');
  var LABEL = TAG('label');
  var SPAN = TAG('span');
  var INPUT = TAG('input');
  var SELECT = TAG('select');
  var OPTION = TAG('option');
  var TEXTAREA = TAG('textarea');
  var BUTTON = TAG('button');
  var FIELDSET = TAG('fieldset');
  var LEGEND = TAG('legend');

  /* =========================
   * 1) flattenFields
   * ========================= */
  function flattenFields(fields) {
    var out = [];
    (fields || []).forEach(function (f) {
      if (!f) return;
      if (f.type === 'slot') {
        if (Array.isArray(f.fields)) out = out.concat(flattenFields(f.fields));
        return; // slot сам по себе не value-field
      }
      if (f.type === 'table') return;
      out.push(f);
    });
    return out;
  }

  /* =========================
   * 2) Controls
   * ========================= */
  function createControl(field, ctx) {
    var ph = (field.placeholder != null) ? field.placeholder : (field.label || '');

    function apply(a) {
      return _isObj(field.attrs) ? _merge(a, field.attrs) : a;
    }

    function formClass(base) {
      base = base || 'form-control';
      return field.inputClass ? _cls(base, field.inputClass) : base;
    }

    // Read-only label field (display value)
    // Usage:
    // { id:'incoming_status', type:'label', label:'Статус', value:'NEW' }
    if (field.type === 'label') {
      var wrap = apply({
        id: field.id,
        class: _cls('formui-label', field.containerClass || ''),
        'data-formui-type': 'label'
      });

      // value node has stable id for setValues: <id>__value
      var valueId = field.id ? (field.id + '__value') : null;
      var valText = (field.value == null) ? '' : String(field.value);

      var valAttrs = {
        id: valueId,
        class: _cls('formui-label-value', field.valueClass || ''),
      };
      if (_isObj(field.valueAttrs)) valAttrs = _merge(valAttrs, field.valueAttrs);

      return DIV(wrap, SPAN(valAttrs, valText));
    }


    // Slot (nested FormUI grid)
    if (field.type === 'slot') {
      var wrapAttrs = apply({
        id: field.id,
        class: field.containerClass || field.fieldsetClass || ''
      });

      // Заголовок слота (если указан title)
      var title = (field.title && String(field.title).trim() !== '')
        ? DIV({class: 'form-ui-slot-title'}, String(field.title))
        : null;

      var body = DIV({class: 'form-ui-slot-body'});

      var innerFields = Array.isArray(field.fields) ? field.fields : [];
      var innerLayout = field.layout || field.columnsPerRow || 1;

      var renderGrid =
        (FormUI.Layout && typeof FormUI.Layout.render === 'function')
          ? FormUI.Layout.render
          : (typeof FormUI.renderFieldsBootstrapGrid === 'function' ? FormUI.renderFieldsBootstrapGrid : null);

      if (!renderGrid) {
        throw new Error('Layout renderer not found. Load layout.js before rendering slot fields.');
      }

      // actions внутри slot
      var innerActions = Array.isArray(field.actions) ? field.actions : null;

// для align внутри slot — не ломая глобальные options
      var innerOptions = ctx && ctx.options ? ctx.options : {};
      if (field.actionsAlign) {
        // создаём “мягкую копию”, чтобы не мутировать общий options
        innerOptions = Object.assign({}, innerOptions, {actionsAlign: field.actionsAlign});
      }

      renderGrid(
        body,
        innerFields,
        innerLayout,
        innerActions,                 // <-- ВАЖНО: сюда передаём actions
        ctx && ctx.breakpoint,
        innerOptions
      );

      // title ставим над body
      return DIV(wrapAttrs, title, body);
    }

    // Custom renderer
    if (field.type === 'custom' && typeof field.render === 'function') {
      var node = (FormUI.dom && typeof FormUI.dom.toNode === 'function')
        ? FormUI.dom.toNode(field.render(field, ctx || {}) || '')
        : null;

      if (node && node.nodeType === 1 && field.id && !node.getAttribute('id')) node.setAttribute('id', field.id);
      return node || document.createTextNode('');
    }

    // Button
    if (field.type === 'button') {
      var bcls = field.btnClass || (field.attrs && field.attrs.class) || 'btn btn-default';
      return BUTTON(apply({
        id: field.id,
        type: 'button',
        class: bcls
      }), field.text != null ? String(field.text) : '');
    }

    // Select2 registry hook
    var isS2 = field.type === 'select2';
    var isAjax = field.type === 'select2-ajax';
    if ((isS2 || isAjax) && field.select2 && field.id) {
      FormUI.Select2 = FormUI.Select2 || {};
      FormUI.Select2.registry = FormUI.Select2.registry || {};
      FormUI.Select2.registry[field.id] = field.select2;
      // совместимость со старым API
      FormUI._select2Registry = FormUI.Select2.registry;
    }

    if (isAjax) {
      var a = apply({
        id: field.id,
        name: field.name || field.id,
        type: 'hidden',
        class: _cls(formClass('form-control'), 'select2 select2-ajax')
      });
      if (field.value != null) a.value = field.value;
      return INPUT(a);
    }

    if (field.type === 'select' || isS2) {
      var sa = apply({
        id: field.id,
        name: field.name || field.id,
        class: formClass('form-control')
      });
      if (isS2) sa.class = _cls(sa.class, 'select2');
      if (ph && !('data-placeholder' in (field.attrs || {}))) sa['data-placeholder'] = ph;

      var opts = (field.options || []).map(function (o) {
        if (typeof o === 'string') o = {value: o, text: o};
        var oa = {value: o.value};
        if (o.selected) oa.selected = true;
        return OPTION(oa, o.text);
      });
      return SELECT(sa, opts);
    }

    if (field.type === 'textarea') {
      return TEXTAREA(apply({
        id: field.id,
        name: field.name || field.id,
        class: formClass('form-control'),
        placeholder: ph
      }), field.value != null ? String(field.value) : '');
    }

    if (field.type === 'checkbox') {
      var ca = apply({
        id: field.id,
        name: field.name || field.id,
        type: 'checkbox',
        class: field.inputClass || ''
      });
      if (field.value != null) ca.value = field.value;
      if (field.checked) ca.checked = true;
      return INPUT(ca);
    }

    if (field.type === 'radio') {
      var ra = apply({
        id: field.id,
        name: field.name || field.id,
        type: 'radio',
        class: field.inputClass || '',
        value: field.value != null ? field.value : ''
      });
      if (field.checked) ra.checked = true;
      return INPUT(ra);
    }

    // Table widget placeholder (QueryTable mount)
    if (field.type === 'table') {
      var wrapAttrs = apply({
        id: field.id,
        class: _cls('form-ui-table', field.containerClass || '')
      });

      var code =
        field.table && field.table.jspParams && field.table.jspParams.queryTableCode
          ? String(field.table.jspParams.queryTableCode)
          : '';

      if (code) wrapAttrs['data-querytable-code'] = code;

      // optional title inside widget
      var title = field.title
        ? DIV({class: 'form-ui-table-title'}, String(field.title))
        : null;

      var mount = DIV({class: 'form-ui-table-mount'});

      return DIV(wrapAttrs, title, mount);
    }

    // default: input
    var ia = apply({
      id: field.id,
      name: field.name || field.id,
      type: field.type || 'text',
      class: formClass('form-control'),
      placeholder: ph
    });
    if (field.value != null) ia.value = field.value;
    return INPUT(ia);
  }

  function renderCheckboxInline(f, ctl) {
    return DIV({class: 'checkbox'}, LABEL(null, ctl, ' ', f.label || ''));
  }

  function renderRadioInline(f, ctl) {
    return DIV({class: 'radio'}, LABEL(null, ctl, ' ', f.label || ''));
  }

  function renderCheckboxesList(f) {
    var selected = Array.isArray(f.value) ? f.value.slice() : (Array.isArray(f.checkedValues) ? f.checkedValues.slice() : []);
    var name = f.name || f.id;
    var dir = f.direction || 'column'; // row|column
    var itemAttrs = _isObj(f.itemAttrs) ? f.itemAttrs : null;

    var list = (f.options || []).map(function (o, idx) {
      if (typeof o === 'string') o = {value: o, text: o};
      var id = f.id + '__' + idx;

      var attrs = _merge({
        id: id,
        name: name,
        type: 'checkbox',
        value: (o.value != null ? o.value : o.text),
        'data-formui-group': f.id
      }, itemAttrs || {});
      if (_isObj(f.attrs)) attrs = _merge(attrs, f.attrs);
      if (_isObj(o.attrs)) attrs = _merge(attrs, o.attrs);

      if (selected.map(String).indexOf(String(attrs.value)) >= 0) attrs.checked = true;

      var item = DIV({class: 'checkbox'}, LABEL({for: id}, INPUT(attrs), ' ', (o.text != null ? o.text : String(attrs.value))));

      if (dir === 'row') {
        item.style.display = 'inline-block';
        item.style.marginRight = '16px';
        item.style.marginBottom = '6px';
      }
      return item;
    });

    return DIV({class: 'formui-checkboxes'}, list);
  }

  function renderRadiosList(f) {
    var name = f.name || f.id;
    var selected = (f.value != null) ? String(f.value) : '';
    var dir = f.direction || 'column'; // row|column
    var itemAttrs = _isObj(f.itemAttrs) ? f.itemAttrs : null;

    var list = (f.options || []).map(function (o, idx) {
      if (typeof o === 'string') o = {value: o, text: o};
      var id = f.id + '__' + idx;

      var attrs = _merge({
        id: id,
        name: name,
        type: 'radio',
        value: (o.value != null ? o.value : o.text),
        'data-formui-group': f.id
      }, itemAttrs || {});
      if (_isObj(f.attrs)) attrs = _merge(attrs, f.attrs);
      if (_isObj(o.attrs)) attrs = _merge(attrs, o.attrs);

      if (selected && String(attrs.value) === selected) attrs.checked = true;

      var item = DIV({class: 'radio'}, LABEL({for: id}, INPUT(attrs), ' ', (o.text != null ? o.text : String(attrs.value))));
      if (dir === 'row') {
        item.style.display = 'inline-block';
        item.style.marginRight = '16px';
        item.style.marginBottom = '6px';
      }
      return item;
    });

    return DIV({class: 'formui-radios'}, list);
  }

  FormUI.Controls = {
    create: createControl,
    renderCheckboxesList: renderCheckboxesList,
    renderRadiosList: renderRadiosList,
    renderCheckboxInline: renderCheckboxInline,
    renderRadioInline: renderRadioInline
  };

  /* =========================
   * 3) Field factories
   * ========================= */
  function createAjaxSelect(options) {
    // требует jQuery (как и в исходнике)
    var $ = global.jQuery;
    var queryCode = options.queryCode;
    var initCode = options.initCode || queryCode;
    var displayProp = options.displayProp || 'name';
    var termParam = options.termParam || 'term';
    var idParam = options.idParam || 'id';

    return {
      id: options.id,
      name: options.id,
      label: options.label,
      type: 'select2-ajax',
      required: options.required,
      requiredMessage: options.requiredMessage,
      validators: options.validators,
      select2: {
        placeholder: options.placeholder || options.label,
        allowClear: true,
        minimumInputLength: (options.minLen != null) ? options.minLen : 0,
        id: function (e) {
          return e.id;
        },
        ajax: {
          url: "queryModel?queryModelCode=" + queryCode,
          dataType: 'json',
          data: function (term) {
            var data_obj = {};
            data_obj[termParam] = term;
            data_obj.maxResults = options.limit || 30;
            if (typeof options.extraParams === 'function' && $) {
              $.extend(data_obj, options.extraParams());
            }
            return data_obj;
          },
          results: function (data) {
            return {results: data.list || []};
          }
        },
        formatResult: function (item) {
          return item ? '<div>' + (item[displayProp] || '') + '</div>' : '';
        },
        formatSelection: function (item) {
          return item ? (item[displayProp] || '') : '';
        },
        escapeMarkup: function (m) {
          return m;
        },
        initSelection: function (element, callback) {
          if (!$) return;
          var id = $(element).val();
          if (!id) return;

          var data_obj = {};
          data_obj[idParam] = id;
          if (typeof options.extraParams === 'function') {
            $.extend(data_obj, options.extraParams());
          }

          $.ajax("queryModel?queryModelCode=" + initCode, {
            type: options.initMethod || "get",
            dataType: "json",
            data: data_obj
          }).done(function (resp) {
            // Expect either a single item or a wrapper {list:[...]} (same as ajax.results)
            var item = (resp && resp.list && resp.list[0]) ? resp.list[0] : resp;
            callback(item);
          });
        }
      },
      onChange: function (val, data) {
        if (typeof options.afterChange !== 'function') return;

        if (Array.isArray(data)) data = data[0] || null;

        if (!data) {
          try {
            var el = document.getElementById(options.id);
            if (el && global.jQuery && global.jQuery.fn && typeof global.jQuery.fn.select2 === 'function') {
              var arr = global.jQuery(el).select2('data');
              data = (arr && arr.length) ? arr[0] : null;
            }
          } catch (e) {}
        }

        // Call afterChange even on clear (data can be null)
        options.afterChange(data);
      }
    };
  }

  FormUI.Fields = FormUI.Fields || {};
  FormUI.Fields.flatten = flattenFields;
  FormUI.Fields.createAjaxSelect = createAjaxSelect;
  // совместимость со старым API
  FormUI.createAjaxSelect = createAjaxSelect;

})(this);