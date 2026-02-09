/* validation.js — validators + validate/validateField/validateGroup + error UI */
(function (global) {
  'use strict';

  var FormUI = global.FormUI = global.FormUI || {};

  // deps
  var env = FormUI.env || {};
  var rootEl = env.rootEl;
  var getByIdIn = env.getByIdIn;
  var hasJQ = env.hasJQ || function(){ return !!global.jQuery; };
  var isVisible = (FormUI.Helpers && typeof FormUI.Helpers.isVisible === 'function')
    ? FormUI.Helpers.isVisible : null;

  var utils = FormUI.utils || {};
  var isObj = utils.isObj || function(x){ return x && typeof x==='object' && !Array.isArray(x) && !x.nodeType; };
  var empty = utils.empty || function(v){
    if(v==null) return true;
    if(typeof v==='string') return v.trim()==='';
    if(Array.isArray(v)) return v.length===0;
    return false;
  };
  var promiseLike = utils.promiseLike || function(x){ return x && typeof x.then==='function'; };

  // prefer Values module if available
  var Values = FormUI.Values || {};
  var getValues = (Values && typeof Values.get === 'function') ? Values.get : null;
  var getValue = (Values && typeof Values.getValue === 'function') ? Values.getValue : null;

  // container normalization: allow "mainForm" or "#mainForm" or DOM element
  function normContainer(container) {
    if (!container) return container;
    if (container.nodeType === 1) return container;
    if (typeof container !== 'string') return container;
    var sel = container.trim();
    if (!sel) return container;
    // plain id -> '#id'
    if (sel.charAt(0) !== '#' && /^[A-Za-z][\w\-:.]*$/.test(sel)) sel = '#' + sel;
    return sel;
  }

  // Skip hidden fields by default (unless options.includeHidden === true)
  function shouldSkipHidden(container, field, options) {
    if (options && options.includeHidden) return false;
    if (!field || !field.id) return false;

    // Preferred: use Helpers.isVisible
    try {
      if (isVisible) return !isVisible(container, field.id);
    } catch (e0) {
    }

    // Fallback: raw DOM checks
    try {
      var el = getByIdIn ? getByIdIn(container, field.id) : null;
      if (!el) return false;

      // explicit hidden marker
      if (el.getAttribute && el.getAttribute('data-formui-hidden') === '1') return true;

      // display:none on element
      if (el.style && String(el.style.display).toLowerCase() === 'none') return true;
      // display:none on any parent up to root
      var p = el.parentNode;
      var root = rootEl ? rootEl(container) : null;
      while (p && p !== root) {
        if (p.style && String(p.style.display).toLowerCase() === 'none') return true;
        if (p.getAttribute && p.getAttribute('data-formui-hidden') === '1') return true;
        p = p.parentNode;
      }
    } catch (e1) {
    }

    return false;
  }


  /* =========================
   * Select2 internal guard (for validateGroup DOM scan)
   * ========================= */
  function isSelect2Internal(el){
    var id = el.id || '';
    var nm = el.name || '';
    if(id.indexOf('s2id_autogen') === 0) return true;
    if(nm.indexOf('s2id_autogen') === 0) return true;
    if(el.classList){
      if(el.classList.contains('select2-input')) return true;
      if(el.classList.contains('select2-focusser')) return true;
    }
    return false;
  }

  /* =========================
   * Fallback getValues/getValue (если values.js не подключён)
   * ========================= */
  function fallbackGetValues(container){
    container = normContainer(container);
    var root = rootEl ? rootEl(container) : container;
    var out = {};
    if(!root) return out;

    root.querySelectorAll('input,select,textarea').forEach(function(el){
      if(el.disabled) return;
      if(isSelect2Internal(el)) return;

      var grp = el.getAttribute('data-formui-group');

      if(el.type==='checkbox' && grp){
        var k = el.name || grp;
        if(!Array.isArray(out[k])) out[k]=[];
        if(el.checked) out[k].push(el.value);
        return;
      }
      if(el.type==='radio' && grp){
        var kr = el.name || grp;
        if(el.checked) out[kr]=el.value;
        else if(!(kr in out)) out[kr]=null;
        return;
      }

      var name = el.name || el.id;
      if(!name) return;

      if(el.type==='checkbox') out[name]=el.checked;
      else if(el.type==='radio'){
        if(el.checked) out[name]=el.value;
        else if(!(name in out)) out[name]=null;
      } else {
        out[name]=el.value;
      }
    });

    return out;
  }

  function fallbackGetValue(container, field){
    if(!field) return null;
    if(field.type==='button' || field.type==='custom' || field.type==='label') return null;
    container = normContainer(container);

    var root = rootEl ? rootEl(container) : container;
    if(!root) return null;

    if(field.type==='checkboxes'){
      var out=[], nodes=root.querySelectorAll('input[type=checkbox][data-formui-group="'+field.id+'"]');
      for(var i=0;i<nodes.length;i++) if(nodes[i].checked) out.push(nodes[i].value);
      return out;
    }
    if(field.type==='radios'){
      var nodes2=root.querySelectorAll('input[type=radio][data-formui-group="'+field.id+'"]');
      for(var j=0;j<nodes2.length;j++) if(nodes2[j].checked) return nodes2[j].value;
      return '';
    }

    var el = getByIdIn ? getByIdIn(container, field.id) : null;
    if(!el) return null;
    if(el.type==='checkbox') return !!el.checked;
    return el.value;
  }

  function _getValues(container){
    container = normContainer(container);
    return getValues ? getValues(container) : fallbackGetValues(container);
  }
  function _getValue(container, field){
    container = normContainer(container);
    return getValue ? getValue(container, field) : fallbackGetValue(container, field);
  }

  /* =========================
   * Error UI helpers
   * ========================= */
  function clearErrors(container){
    if(!hasJQ()) return;
    container = normContainer(container);
    var $ = global.jQuery, $root = $(container);
    $root.find('.formui-error').remove();
    $root.find('.has-error').removeClass('has-error');
    $root.find('[aria-invalid="true"]').attr('aria-invalid','false');
  }

  function setErrors(container, errors){
    if(!hasJQ()) return;
    container = normContainer(container);
    var $ = global.jQuery, $root = $(container);

    Object.keys(errors||{}).forEach(function(fid){
      var msg = errors[fid];
      if(!msg) return;

      var domEl = getByIdIn ? getByIdIn(container, fid) : null;
      var $el = domEl ? $(domEl) : $root.find('input[data-formui-group="'+fid+'"]:first');
      if(!$el.length) return;

      $el.attr('aria-invalid','true');

      var $col = $el.closest('[class*="col-"]');
      if($col.length) $col.addClass('has-error');

      var $msg = $('<div class="help-block formui-error"></div>').text(String(msg));
      var $grp = $el.closest('.formui-checkboxes, .formui-radios');

      if($grp.length) $msg.insertAfter($grp);
      else $msg.insertAfter($el);
    });
  }

  function clearFieldError(container, fid){
    if(!hasJQ()) return;
    container = normContainer(container);
    var $ = global.jQuery, $root = $(container);

    var domEl = getByIdIn ? getByIdIn(container, fid) : null;
    var $el = domEl ? $(domEl) : $root.find('input[data-formui-group="'+fid+'"]:first');
    if(!$el.length) return;

    $el.attr('aria-invalid','false');

    var $col = $el.closest('[class*="col-"]');
    if($col.length) $col.removeClass('has-error');

    var $grp = $el.closest('.formui-checkboxes, .formui-radios');
    if($grp.length) $grp.next('.help-block.formui-error').remove();
    else $el.next('.help-block.formui-error').remove();
  }

  function setFieldError(container, fid, msg){
    if(!hasJQ()) return;
    container = normContainer(container);
    var $ = global.jQuery, $root = $(container);

    var domEl = getByIdIn ? getByIdIn(container, fid) : null;
    var $el = domEl ? $(domEl) : $root.find('input[data-formui-group="'+fid+'"]:first');
    if(!$el.length) return;

    $el.attr('aria-invalid','true');

    var $col = $el.closest('[class*="col-"]');
    if($col.length) $col.addClass('has-error');

    var $grp = $el.closest('.formui-checkboxes, .formui-radios');
    if($grp.length){
      $grp.next('.help-block.formui-error').remove();
      $('<div class="help-block formui-error"></div>').text(String(msg)).insertAfter($grp);
    } else {
      $el.next('.help-block.formui-error').remove();
      $('<div class="help-block formui-error"></div>').text(String(msg)).insertAfter($el);
    }
  }

  /* =========================
   * Validators registry
   * ========================= */
  var validators = {};

  function norm(res, fallback){
    if(res == null || res === true) return { ok:true };
    if(res === false) return { ok:false, message:fallback || 'Некорректное значение' };
    if(typeof res === 'string') return { ok:false, message:res };
    if(isObj(res) && typeof res.ok === 'boolean'){
      return res.ok ? { ok:true } : { ok:false, message:res.message || fallback || 'Некорректное значение' };
    }
    return { ok:true };
  }

  validators.required = function(value, ctx, params){
    var msg = (params && params.message) || 'Поле обязательно';

    // Select2 / complex objects:
    // Treat object as empty when it has an id/value and that id/value is empty.
    // This fixes "required" for select2-ajax where getValue() may return {id, text, ...}.
    function _isEmptyComplex(v){
      if(!v || typeof v !== 'object') return false;
      // Prefer id, then value (common patterns)
      if (v.id != null) return empty(String(v.id));
      if (v.value != null) return empty(String(v.value));
      return false;
    }

    // Select2 v3.5 often returns ARRAY from select2('data').
    // For single-select we treat [obj] like obj.
    function _isEmptySelect2Array(v){
      if(!Array.isArray(v)) return false;
      if(v.length === 0) return true;
      // single-select common: [ {id:'', text:''} ]
      var first = v[0];
      if(first && typeof first === 'object') return _isEmptyComplex(first);
      return false;
    }

    if(typeof ctx.field.required === 'function') return ctx.field.required(value, ctx);

    if(typeof ctx.field.required === 'string'){
      if(value === false || empty(value) || _isEmptyComplex(value) || _isEmptySelect2Array(value)) return ctx.field.required;
      return true;
    }

    if(ctx.field.required === true){
      if(value === false || empty(value) || _isEmptyComplex(value) || _isEmptySelect2Array(value)) return msg;
    }

    return true;
  };

  validators.minLen = function(value, ctx, params){
    // var n = params && (params.value != null ? params.value : params.min);
    // if(n == null || empty(value)) return true;
    // return String(value).length >= n || (params && params.message) || ('Минимум ' + n + ' символов');
    var n = Number(params && (params.value != null ? params.value : params));
    if (!n) return true;

    // treat empty as invalid when minLen is specified
    if (value == null || value === '') {
      return (params && params.message) || ('Минимальная длина: ' + n);
    }

    return String(value).length >= n
      || (params && params.message)
      || ('Минимальная длина: ' + n);
  };

  validators.maxLen = function(value, ctx, params){
    var n = params && (params.value != null ? params.value : params.max);
    if(n == null || empty(value)) return true;
    return String(value).length <= n || (params && params.message) || ('Максимум ' + n + ' символов');
  };


  // min validator (numbers)
  // Usage: { type:'min', value:18, message:'Минимум 18' }
  validators.min = function (value, ctx, params) {
    var n = Number(params && (params.value != null ? params.value : params));
    if (!n) return true;

    // treat empty as invalid when min is specified
    if (value == null || value === '') {
      return (params && params.message) || ('Минимум: ' + n);
    }

    return Number(value) >= n
      || (params && params.message)
      || ('Минимум: ' + n);
  };

  // max validator (numbers)
  // Usage: { type:'max', value:99, message:'Максимум 99' }
  validators.max = function (value, ctx, params) {
    var n = params && (params.value != null ? params.value : params.max);
    if (n == null || empty(value)) return true;
    var x = Number(value);
    if (isNaN(x)) return (params && params.message) || ('Максимум ' + n);
    return x <= Number(n) || (params && params.message) || ('Максимум ' + n);
  };


  // Email validator
  // Usage:
  //   validators: [{ type:'email', message:'Некорректный email' }]
  // Also works if value is a Select2 object/array (tries to use .id/.value/.text)
  validators.email = function(value, ctx, params){
    if (value == null || value === '') return true; // allow empty unless required

    function pick(v){
      if (Array.isArray(v)) v = v[0];
      if (v && typeof v === 'object'){
        if (v.id != null) return String(v.id);
        if (v.value != null) return String(v.value);
        if (v.text != null) return String(v.text);
        return '';
      }
      return String(v);
    }

    var s = pick(value).trim();
    if (!s) return true;

    var re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return re.test(s) || (params && params.message) || 'Некорректный email';
  };

  // Pattern / Regex validator
  // Usage:
  //   validators: [{ type:'pattern', pattern:'^\\d{4}-\\d{2}-\\d{2}$', flags:'', message:'YYYY-MM-DD' }]
  //   validators: [{ type:'regex', regex:/^\\d+$/ , message:'Только цифры' }]
  validators.pattern = function(value, ctx, params){
    if (value == null || value === '') return true; // allow empty unless required
    var s = String(value);

    var rx = null;
    try {
      if (params && params.regex instanceof RegExp) {
        rx = params.regex;
      } else if (params && params.pattern instanceof RegExp) {
        rx = params.pattern;
      } else {
        var pat = (params && (params.pattern != null ? params.pattern : params.value));
        if (pat == null) return true;
        if (pat instanceof RegExp) {
          rx = pat;
        } else {
          var flags = (params && params.flags) ? String(params.flags) : '';
          rx = new RegExp(String(pat), flags);
        }
      }
    } catch (e) {
      return true;
    }

    return rx.test(s) || (params && params.message) || 'Некорректный формат';
  };

  // alias: type:'regex'
  validators.regex = function(value, ctx, params){
    return validators.pattern(value, ctx, params);
  };

  function registerValidator(name, fn){
    if(name && typeof fn === 'function') validators[name] = fn;
  }

  /* =========================
   * Validation engine
   * ========================= */
  function ctxBuild(container, field, fields){
    container = normContainer(container);
    var vals = _getValues(container);
    return {
      container: container,
      field: field,
      fields: fields || [],
      values: vals,
      getValue: function(id){ return vals[id]; },
      $: hasJQ() ? global.jQuery : null
    };
  }

  function fieldValidators(field){
    var list = [];
    if(field.required){
      list.push({
        type: 'required',
        message: (typeof field.required === 'string')
          ? field.required
          : (field.requiredMessage || 'Поле обязательно')
      });
    }
    if(Array.isArray(field.validators)){
      field.validators.forEach(function(v){ list.push(v); });
    }
    // allow validators as object map: { ruleName: fn, ... }
    else if(isObj(field.validators)){
      Object.keys(field.validators).forEach(function(k){
        var fn = field.validators[k];
        if(typeof fn === 'function') list.push(fn);
      });
    }

    // AUTO: type==='email' -> apply email validator if not explicitly specified
    if(field && field.type === 'email'){
      var hasEmail = false;
      for (var i = 0; i < list.length; i++) {
        var v = list[i];
        if (v && typeof v === 'object' && v.type === 'email') { hasEmail = true; break; }
      }
      if (!hasEmail) {
        list.push({ type:'email', message: field.emailMessage || field.validatorEmailMessage || 'Некорректный email' });
      }
    }
    return list;
  }

  function runValidator(v, value, ctx){
    if(typeof v === 'function'){
      var r = v(value, ctx);
      return promiseLike(r)
        ? r.then(function(x){ return norm(x, 'Некорректное значение'); })
        : Promise.resolve(norm(r, 'Некорректное значение'));
    }

    if(isObj(v)){
      var fn = validators[v.type];
      if(typeof fn !== 'function') return Promise.resolve({ ok:true });

      var r2 = fn(value, ctx, v);
      return promiseLike(r2)
        ? r2.then(function(x){ return norm(x, v.message); })
        : Promise.resolve(norm(r2, v.message));
    }

    return Promise.resolve({ ok:true });
  }

  var validateToken = {};

  function validateField(container, fieldOrId, fields, options){
    container = normContainer(container);
    options = options || {};

    var field = (typeof fieldOrId === 'string')
      ? (fields || []).filter(function(f){ return f && f.id === fieldOrId; })[0]
      : fieldOrId;

    // Skip hidden fields by default
    if (shouldSkipHidden(container, field, options)) {
      // Clear stale error UI if any
      try { clearFieldError(container, field.id); } catch(e0) {}
      return Promise.resolve({ ok:true, skipped:true });
    }

    var token = (validateToken[field.id] || 0) + 1;
    validateToken[field.id] = token;

    var ctx = ctxBuild(container, field, fields);
    var value = _getValue(container, field);
    var list = fieldValidators(field);
    var stop = (options.stopOnFirstError !== false);

    var p = Promise.resolve({ ok:true });
    list.forEach(function(v){
      p = p.then(function(prev){
        if(!prev.ok && stop) return prev;
        return runValidator(v, value, ctx);
      });
    });

    return p.then(function(res){
      // stale async result
      if(validateToken[field.id] !== token) return { ok:true, _stale:true };

      var out = (!res || res.ok)
        ? { ok:true }
        : { ok:false, message: res.message || 'Некорректное значение' };

      // show/hide only this field error (do not clear all)
      if(hasJQ() && options.showErrors !== false){
        if(out.ok) clearFieldError(container, field.id);
        else setFieldError(container, field.id, out.message);
      }

      return out;
    });
  }

  function validate(container, fields, options){
    container = normContainer(container);
    options = options || {};
    var show = (options.showErrors !== false);

    var out = { ok:true, values:_getValues(container), fields:{} };
    var errs = {};
    var chain = Promise.resolve();

    (fields || []).forEach(function(field){
      if(field && field.type === 'label') return;
      chain = chain.then(function(){
        if (shouldSkipHidden(container, field, options)) {
          try {
            clearFieldError(container, field.id);
          } catch (e0) {
          }
          out.fields[field.id] = {ok: true, skipped: true};
          return null;
        }
        return validateField(container, field, fields, options).then(function(r){
          if(!field || !field.id) return;
          if(!r || r.ok || r._stale){
            out.fields[field.id] = { ok:true };
            return;
          }
          out.ok = false;
          out.fields[field.id] = { ok:false, message:r.message };
          errs[field.id] = r.message;
        });
      });
    });

    return chain.then(function(){
      if(hasJQ() && show){
        clearErrors(container);
        if(!out.ok) setErrors(container, errs);
      }
      out.values = _getValues(container);
      return out;
    });
  }

  // Validate only fields inside a rendered layout group (row.type='group')
  function validateGroup(container, fields, groupId, options){
    container = normContainer(container);
    options = options || {};
    var root = rootEl ? rootEl(container) : container;
    if(!root) return Promise.resolve({ ok:true, values:_getValues(container), fields:{} });
    if(!groupId) return Promise.resolve({ ok:true, values:_getValues(container), fields:{} });

    // group container rendered as DIV with id=groupId inside .form-ui-scope
    var groupEl = getByIdIn ? getByIdIn(container, groupId) : null;
    if(!groupEl) return Promise.resolve({ ok:true, values:_getValues(container), fields:{} });

    // collect ids of fields inside group DOM
    var idsSet = {};
    groupEl.querySelectorAll('input,select,textarea').forEach(function(el){
      if(el.disabled) return;
      if(isSelect2Internal(el)) return;

      var gid = el.getAttribute('data-formui-group');
      if(gid) { idsSet[gid] = true; return; }

      if(el.id) { idsSet[el.id] = true; return; }
    });

    var subset = (fields || []).filter(function(f){
      if (!f || !f.id || !idsSet[f.id]) return false;
      if (shouldSkipHidden(container, f, options)) {
        try {
          clearFieldError(container, f.id);
        } catch (e0) {
        }
        return false;
      }
      return true;
    });

    if(!subset.length){
      return Promise.resolve({ ok:true, values:_getValues(container), fields:{} });
    }

    return validate(container, subset, options);
  }

  /* =========================
   * export
   * ========================= */
  FormUI.Validation = {
    validators: validators,
    registerValidator: registerValidator,
    validate: validate,
    validateField: validateField,
    validateGroup: validateGroup,
    clearErrors: clearErrors,
    setErrors: setErrors,
    clearFieldError: clearFieldError,
    setFieldError: setFieldError
  };

  // backward compat (как в исходнике)
  FormUI.validators = validators;
  FormUI.registerValidator = registerValidator;
  FormUI.validate = validate;
  FormUI.validateField = validateField;
  FormUI.validateGroup = validateGroup;
  FormUI.clearErrors = clearErrors;
  FormUI.setErrors = setErrors;
})(this);