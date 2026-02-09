/* values.js — get/set/clear + setDisable */
(function (global) {
  'use strict';

  var FormUI = global.FormUI = global.FormUI || {};
  var S2_GUARD_KEY = '__formui_s2_guard';
  // deps
  var env = FormUI.env || {};
  var rootEl = env.rootEl;
  var getByIdIn = env.getByIdIn;
  var hasJQ = env.hasJQ || function(){ return !!global.jQuery; };
  var hasSelect2 = env.hasSelect2 || function(){ return hasJQ() && typeof global.jQuery.fn.select2 === 'function'; };

  /* =========================
   * Select2 internal inputs guard
   * ========================= */
  function isSelect2Internal(el){
    var id = el.id || '';
    var nm = el.name || '';

    // Select2 v3.5 generates helper inputs like: s2id_autogenX and s2id_autogenX_search
    if (id.indexOf('s2id_autogen') === 0) return true;
    if (nm.indexOf('s2id_autogen') === 0) return true;

    if (el.classList){
      if (el.classList.contains('select2-input')) return true;     // search input
      if (el.classList.contains('select2-focusser')) return true;  // focus helper
    }
    return false;
  }

  /* =========================
   * Low-level single-field reader
   * (used by events.js too, if you want later)
   * ========================= */
  /*
  function getValue(container, field){
    if(!field) return null;
    if(field.type === 'button' || field.type === 'custom') return null;

    var root = rootEl ? rootEl(container) : container;
    if(!root) return null;

    if(field.type === 'checkboxes'){
      var out = [];
      var nodes = root.querySelectorAll('input[type=checkbox][data-formui-group="'+field.id+'"]');
      for(var i=0;i<nodes.length;i++) if(nodes[i].checked) out.push(nodes[i].value);
      return out;
    }

    if(field.type === 'radios'){
      var nodes2 = root.querySelectorAll('input[type=radio][data-formui-group="'+field.id+'"]');
      for(var j=0;j<nodes2.length;j++) if(nodes2[j].checked) return nodes2[j].value;
      return '';
    }

    var el = getByIdIn ? getByIdIn(container, field.id) : null;
    if(!el) return null;
    if(el.type === 'checkbox') return !!el.checked;
    return el.value;
  }
  */

  function normId(id) {
    if (id == null) return '';
    if (typeof id !== 'string') return id;
    id = id.trim();
    if (!id) return '';
    return (id.charAt(0) === '#') ? id.slice(1) : id;
  }

  function normContainer(container) {
    if (!container) return container;
    if (container.nodeType === 1) return container;
    if (typeof container !== 'string') return container;
    var sel = container.trim();
    if (!sel) return container;
    // if looks like a plain id, convert to '#id'
    // do NOT touch complex selectors like '.a .b', 'div#x', '[data-x]'
    if (sel.charAt(0) !== '#' && /^[A-Za-z][\w\-:.]*$/.test(sel)) {
      sel = '#' + sel;
    }
    return sel;
  }

  function getValue(container, fieldOrId) {
    if (!fieldOrId) return null;
    container = normContainer(container);

    // normalize: allow passing {id,...} or "id"
    var field = (typeof fieldOrId === 'string') ? {id: fieldOrId} : fieldOrId;
    if (!field || !field.id) return null;
    field.id = normId(field.id);
    if (field.type === 'button' || field.type === 'custom') return null;

    var root = rootEl ? rootEl(container) : container;
    if (!root) return null;

    var id = field.id;

    // radios (explicit type OR autodetect by group nodes)
    var radioNodes = root.querySelectorAll('input[type=radio][data-formui-group="' + id + '"]');
    if (field.type === 'radios' || (!field.type && radioNodes && radioNodes.length)) {
      for (var j = 0; j < radioNodes.length; j++) if (radioNodes[j].checked) return radioNodes[j].value;
      return '';
    }

    // checkboxes group (explicit type OR autodetect when group nodes exist)
    var cbNodes = root.querySelectorAll('input[type=checkbox][data-formui-group="' + id + '"]');

    // main element by id (may not exist for checkbox groups)
    var el = getByIdIn ? getByIdIn(container, id) : null;

    // if it's a checkbox group (or no main element, but group nodes exist)
    if (field.type === 'checkboxes' || (!field.type && cbNodes && cbNodes.length && (!el || el.type !== 'checkbox' || cbNodes.length > 1))) {
      var out = [];
      for (var i = 0; i < cbNodes.length; i++) if (cbNodes[i].checked) out.push(cbNodes[i].value);
      return out;
    }

    if (!el) return null;

    // Select2 v3.5: return full data object/array
    if (hasJQ()) {
      try {
        var $ = global.jQuery;
        var $el = $(el);
        if ($el && $el.hasClass('select2') && $el.data('select2')) {
          return $el.select2('data') || null;
        }
      } catch (eS2) {
      }
    }

    // single checkbox
    if (el.type === 'checkbox') return !!el.checked;
    return el.value;
  }

  /* =========================
   * getValues
   * ========================= */
  function getValues(container, opts) {
    opts = opts || {};
    container = normContainer(container);
    var includeHidden = !!opts.includeHidden;
    var root = rootEl ? rootEl(container) : container;
    var out = {};
    if (!root) return out;

    // helper: skip hidden fields (root hidden via Helpers.hide / hidden:true)
    function _skipHidden(id) {
      if (includeHidden) return false;
      if (!id) return false;
      try {
        if (global.FormUI && FormUI.Helpers && typeof FormUI.Helpers.isVisible === 'function') {
          return !FormUI.Helpers.isVisible(container, id);
        }
      } catch (e) {
      }
      return false;
    }

    root.querySelectorAll('input,select,textarea').forEach(function (el) {
      if (el.disabled) return;
      if (isSelect2Internal(el)) return;

      var grp = el.getAttribute('data-formui-group');

      // grouped checkboxes
      if (el.type === 'checkbox' && grp) {
        if (_skipHidden(grp)) return;
        var k = el.name || grp;
        if (!Array.isArray(out[k])) out[k] = [];
        if (el.checked) out[k].push(el.value);
        return;
      }

      // grouped radios
      if (el.type === 'radio' && grp) {
        if (_skipHidden(grp)) return;
        var kr = el.name || grp;
        if (el.checked) out[kr] = el.value;
        else if (!(kr in out)) out[kr] = null;
        return;
      }

      var name = el.name || el.id;
      if (!name) return;
      if (_skipHidden(name)) return;

      if (el.type === 'checkbox') out[name] = el.checked;
      else if (el.type === 'radio') {
        if (el.checked) out[name] = el.value;
        else if (!(name in out)) out[name] = null;
      } else out[name] = el.value;
    });

    return out;
  }

  /* =========================
   * setValues
   * ========================= */
  function setValues(container, values){
    if(!hasJQ()) return;
    container = normContainer(container);
    var $ = global.jQuery, $root = $(container);

    Object.keys(values||{}).forEach(function(k){
      var k0 = k;
      k = normId(k);
      var v = values[k];

      // 1) grouped checkboxes (array)
      if(Array.isArray(v)){
        var $cb = $root.find('input[type=checkbox][data-formui-group="'+k+'"]');
        if($cb.length){
          var set = {};
          v.forEach(function(x){ set[String(x)] = true; });

          $cb.each(function(){
            var val = String($(this).val());
            $(this).prop('checked', !!set[val]);
          });

          // trigger change (as in current code)
          $cb.first().trigger('change');
          return;
        }
      }

      // 2) grouped radios
      var $rd = $root.find('input[type=radio][data-formui-group="'+k+'"]');
      if($rd.length){
        $rd.prop('checked', false);
        $rd.filter('[value="'+String(v)+'"]').prop('checked', true);

        // trigger change on checked, or first fallback
        var $fire = $rd.filter(':checked').first();
        ($fire.length ? $fire : $rd.first()).trigger('change');
        return;
      }

      // 3) single control by id inside container
      var domEl = getByIdIn ? getByIdIn(container, k) : null;
      if(!domEl) return;
      var $el = $(domEl);

      // label field (type:'label') support:
      // fields.js renders value node with id "<fieldId>__value"
      // so we can update it safely via setValues without HTML strings.
      var valueEl = getByIdIn ? getByIdIn(container, k + '__value') : null;
      if (valueEl) {
        try {
          //valueEl.textContent = (v == null) ? '' : String(v);
          if (v && typeof v === 'object') {
            // text
            if (v.text != null) valueEl.textContent = String(v.text);
            else if (v.value != null) valueEl.textContent = String(v.value);
            else valueEl.textContent = '';

            // className (replace)
            if (v.class) valueEl.className = String(v.class);

            // style
            if (v.style) valueEl.style.cssText += ';' + String(v.style);
            if (v.color) valueEl.style.color = String(v.color);
          } else {
            valueEl.textContent = (v == null) ? '' : String(v);
          }
        } catch (eLbl) {
        }
        return;
      }


      // 3a) non-input elements (custom render output)
      // Allow setValues to update custom widgets like:
      //   <label id="incoming_status" class="control-label">...</label>
      // Supported value formats:
      //   - string/number -> textContent
      //   - { text, color, class, style } -> apply to element (textContent)
      //   - { html } -> innerHTML (use carefully)
      if (domEl.tagName !== 'INPUT' && domEl.tagName !== 'SELECT' && domEl.tagName !== 'TEXTAREA') {
        try {
          if (v && typeof v === 'object') {
            if (v.class) domEl.className = v.class;
            if (v.style) domEl.setAttribute('style', v.style);
            if (v.color) domEl.style.color = v.color;
            if (v.html != null) {
              domEl.innerHTML = String(v.html);
            } else if (v.text != null) {
              domEl.textContent = String(v.text);
            } else {
              domEl.textContent = '';
            }
          } else {
            domEl.textContent = (v == null ? '' : String(v));
          }
        } catch (eCustom) {}
        return;
      }


      // --- Idempotency guard: if value is already set, do nothing ---
      // This prevents infinite loops like: afterChange -> setValues(same value) -> afterChange ...
      function sameSelect2Value($el, v) {
        try {
          var cur = $el.val();
          if (v == null) return (cur == null || cur === '');
          if (typeof v === 'object') {
            var vid = (v.id != null ? String(v.id) : (v.value != null ? String(v.value) : ''));
            return String(cur) === vid;
          }
          return String(cur) === String(v);
        } catch (e) {
          return false;
        }
      }

      // select2 sync
      if($el.hasClass('select2') && $el.data('select2')){
        try{
          // If caller is setting same value again, ignore (prevents cycles)
          if (!Array.isArray(v) && sameSelect2Value($el, v)) {
            try { $el.data(S2_GUARD_KEY, false); } catch (eSame) {}
            return;
          }
          // mark: we are doing a programmatic select2 update
          try { $el.data(S2_GUARD_KEY, true); } catch (e0) {}

          var isMultiple = !!$el.prop('multiple');

          if(Array.isArray(v)){
            // multiple select2: ensure UI sync immediately
            if(v.length && typeof v[0] === 'object'){
              // preserve full objects; ensure {id,text} exists
              var fullArr = v.map(function (x) {
                if (!x || typeof x !== 'object') return x;
                var o = {};
                for (var kk in x) {
                  if (Object.prototype.hasOwnProperty.call(x, kk)) o[kk] = x[kk];
                }
                if (o.id == null) o.id = (x.id != null ? x.id : x.value);
                if (o.text == null) o.text =
                  x.text || x.name || x.label || x.number || String(o.id || '');
                return o;
              });
              $el.select2('data', fullArr);
              if(isMultiple){
                $el.select2('val', fullArr.map(function(x){ return x && x.id != null ? x.id : x; }));
                // $el.select2('val', v.map(function(x){ return x && x.id!=null ? x.id : x; }));
              }
            } else {
              $el.select2('val', v);
            }
          }
          else if(v && typeof v === 'object'){
            // preserve full object; ensure {id,text} exists
            var obj2 = {};
            for (var kk2 in v) {
              if (Object.prototype.hasOwnProperty.call(v, kk2)) obj2[kk2] = v[kk2];
            }
            if (obj2.id == null) obj2.id = (v.id != null ? v.id : v.value);
            if (obj2.text == null) obj2.text =
              v.text || v.name || v.label || v.number || String(obj2.id || '');
            $el.select2('data', obj2);
          }
          else {
            $el.select2('val', v);
            // If select2 has initSelection (v3.5 ajax pattern), try to resolve full object by id
            // so that change handlers (afterChange/onChange) receive rich data.
            var s2 = $el.data('select2');
            var initSel = s2 && s2.opts && s2.opts.initSelection;
            if (typeof initSel === 'function') {
              initSel(domEl, function (data) {
                // Keep guard while writing resolved data (select2 may fire internal 'change')
                try {
                  $el.select2('data', data);
                } catch (e2) {
                }

                // Release guard and fire exactly one change for FormUI handlers
                try {
                  $el.data(S2_GUARD_KEY, false);
                } catch (e3) {
                }
                // Select2 may have already fired change internally; avoid double-trigger
                var fired = false;
                try {
                  $el.one('change.__formui_s2detect', function () {
                    fired = true;
                  });
                } catch (eD) {
                }
                if (!fired) $el.trigger('change');
              });
              return; // change will be triggered in callback
            }
          }

          try { $el.data(S2_GUARD_KEY, false); } catch (e4) {}
          $el.trigger('change');
        } catch(e){
          try { $el.data(S2_GUARD_KEY, false); } catch (e5) {}
          $el.val(v).trigger('change');
        }
      }
      else if($el.attr('type') === 'checkbox'){
        $el.prop('checked', !!v).trigger('change');
      }
      else {
        $el.val(v).trigger('change');
      }
    });
  }

  /* =========================
   * clearValues
   * ========================= */
  function clearValues(container){
    container = normContainer(container);
    var root = rootEl ? rootEl(container) : container;
    if(!root) return;

    root.querySelectorAll('input,select,textarea').forEach(function(el){
      if(el.disabled) return;
      if(isSelect2Internal(el)) return;

      // grouped elements
      if(el.getAttribute('data-formui-group')){
        if(el.type === 'checkbox' || el.type === 'radio') el.checked = false;
        return;
      }

      if(el.type === 'checkbox' || el.type === 'radio') el.checked = false;
      else el.value = '';
    });

    // clear select2 widgets
    if(hasSelect2()){
      var $ = global.jQuery;
      $(container).find('select.select2, input[type=hidden].select2').each(function(){
        var $el = $(this);
        if(!$el.data('select2')) return;
        try { $el.select2('val',''); }
        catch(e){ $el.val('').trigger('change'); }
      });
    }
  }

  /**
   * Bulk disable/enable fields
   * Example:
   *   FormUI.setDisabled('#form', { field1:true, field2:false })
   */
  function setDisabled(container, map) {
    if (!map || typeof map !== 'object') return;
    container = normContainer(container);

    for (var fieldId in map) {
      if (!Object.prototype.hasOwnProperty.call(map, fieldId)) continue;
      setDisable(container, normId(fieldId), !!map[fieldId]);
    }
  }

  /* =========================
   * clearDisabled (enable all)
   * ========================= */
  function clearDisabled(container) {
    container = normContainer(container);
    var root = rootEl ? rootEl(container) : container;
    if (!root) return 0;

    var els = root.querySelectorAll('input[disabled],select[disabled],textarea[disabled],button[disabled]');
    if (!els || !els.length) return 0;

    var enabledCount = 0;

    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el) continue;

      try {
        // remove disabled
        if ('disabled' in el) el.disabled = false;
        el.removeAttribute('disabled');

        // make label normal (if you use grey label class)
        // 1) <label><input/></label>
        var lbl = (el.closest && el.closest('label')) ? el.closest('label') : null;
        // 2) <label for="id">
        if (!lbl && el.id) {
          lbl = root.querySelector('label[for="' + el.id + '"]');
        }
        if (lbl && lbl.classList) {
          lbl.classList.remove('formui-disabled-label');
          lbl.classList.remove('disabled'); // bootstrap style often used
        }

        // select2 sync (v3.5)
        if (hasJQ()) {
          var $ = global.jQuery;
          var $el = $(el);
          if ($el.hasClass('select2') && $el.data('select2')) {
            try {
              $el.select2('enable');
            } catch (e) {
              $el.prop('disabled', false).trigger('change');
            }
          }
        }

        enabledCount++;
      } catch (e) {
      }
    }

    return enabledCount;
  }

  
  /* =========================
   * setDisable
   * ========================= */
  function setDisable(container, fieldId, disabled){
    fieldId = normId(fieldId);
    container = normContainer(container);
    var root = rootEl ? rootEl(container) : container;
    if(!root) return;

    function toggleLabelDisabled(inputEl, disabled) {
      if (!inputEl) return;

      // 1) <label> wrapping input
      var lbl = inputEl.closest && inputEl.closest('label');

      // 2) <label for="id">
      if (!lbl && inputEl.id) {
        lbl = root.querySelector('label[for="' + inputEl.id + '"]');
      }

      if (lbl && lbl.classList) {
        lbl.classList.toggle('formui-disabled-label', !!disabled);
      }
    }
    // 1) radios/checkboxes groups
    var groupEls = root.querySelectorAll('[data-formui-group="' + fieldId + '"]');
    if(groupEls && groupEls.length){
      // avoid NodeList.forEach for old browsers; disable only inputs
      for (var i = 0; i < groupEls.length; i++) {
        var elg = groupEls[i];
        if (elg && elg.tagName === 'INPUT' && ('disabled' in elg)) {
          elg.disabled = !!disabled;
          toggleLabelDisabled(elg, disabled);
        }
      }
      return;
    }

    // 2) single field by id (scoped)
    var el = getByIdIn ? getByIdIn(container, fieldId) : null;
    if(!el) return;

    el.disabled = !!disabled;
    toggleLabelDisabled(el, disabled);

    // 3) select2 sync (v3.5)
    if(hasJQ()){
      var $ = global.jQuery;
      var $el = $(el);

      if($el.hasClass('select2') && $el.data('select2')){
        try {
          $el.select2(disabled ? 'disable' : 'enable');
        } catch(e){
          $el.prop('disabled', !!disabled).trigger('change');
        }
      }
    }
  }

  /* =========================
   * export
   * ========================= */
  FormUI.Values = {
    get: getValues,
    set: setValues,
    clear: clearValues,
    setDisable: setDisable,
    setDisabled: setDisabled,
    clearDisabled: clearDisabled,
    getValue: getValue
  };

  // backward compat
  FormUI.getValue = getValue;
  FormUI.getValues = getValues;
  FormUI.setValues = setValues;
  FormUI.clearValues = clearValues;
  FormUI.setDisable = setDisable;
  FormUI.setDisabled = setDisabled;
  FormUI.clearDisabled = clearDisabled;
})(this);