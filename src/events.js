/* events.js — FormUI.Events (attach/detach) */
(function (global) {
  'use strict';

  var FormUI = global.FormUI = global.FormUI || {};
  var S2_GUARD_KEY = '__formui_s2_guard';
  var env = FormUI.env || {};
  var rootEl = env.rootEl;
  var getByIdIn = env.getByIdIn;
  var hasJQ = env.hasJQ;

  // optional deps
  var Validation = FormUI.Validation || {};
  var validateField = Validation.validateField;

  var Values = FormUI.Values || {};
  var getValueFromValues = (Values && typeof Values.getValue === 'function') ? Values.getValue : null;

  // utils (fallback included)
  var utils = FormUI.utils || {};
  var inArr = utils.inArr || function (a, v) {
    if (a == null) return false;
    var arr = Array.isArray(a) ? a : [a];
    return arr.map(String).indexOf(String(v)) >= 0;
  };

  // fallback reader (if Values.getValue is not available)
  function readFieldValueFallback(container, field) {
    var root = rootEl ? rootEl(container) : container;
    if (!root || !field) return null;

    // grouped checkboxes
    if (field.type === 'checkboxes') {
      var out = [];
      var nodes = root.querySelectorAll('input[type=checkbox][data-formui-group="' + field.id + '"]');
      for (var i = 0; i < nodes.length; i++) if (nodes[i].checked) out.push(nodes[i].value);
      return out;
    }

    // grouped radios
    if (field.type === 'radios') {
      var nodes2 = root.querySelectorAll('input[type=radio][data-formui-group="' + field.id + '"]');
      for (var j = 0; j < nodes2.length; j++) if (nodes2[j].checked) return nodes2[j].value;
      return '';
    }

    // normal control by id
    var el = getByIdIn ? getByIdIn(container, field.id) : null;
    if (!el) return null;

    if (el.type === 'checkbox') return !!el.checked;
    return el.value;
  }

  function readVal(container, field) {
    // prefer shared Values.getValue (single source of truth)
    if (getValueFromValues) {
      try { return getValueFromValues(container, field); }
      catch (e) { /* fallback below */ }
    }
    return readFieldValueFallback(container, field);
  }

  function attachFieldEvents(container, fields, options) {
    if (!hasJQ || !hasJQ()) return;
    var $ = global.jQuery, $root = $(container);
    options = options || {};

    (fields || []).forEach(function (field) {
      if (!field || !field.id) return;

      // 1) try single control by id
      var domEl = getByIdIn ? getByIdIn(container, field.id) : null;
      // 2) else try group by data-formui-group (radios/checkboxes)
      var $el = domEl ? $(domEl) : $root.find('[data-formui-group="' + field.id + '"]');
      if (!$el.length) return;

      function readData($target) {
        var data = null;
        if ($target && $target.hasClass('select2') && $target.data('select2')) {
          try { data = $target.select2('data'); } catch (e) {}
        }
        return data;
      }

      // onChange
      if (typeof field.onChange === 'function') {
        $el.off('change.formui').on('change.formui', function (e) {
          var $t = $(this);
          // Ignore programmatic Select2 changes while Values.setValues is syncing.
          // This prevents infinite loops (A.afterChange -> setValues(B) -> internal change -> ...).
          try {
            if ($t && $t.hasClass('select2') && $t.data('select2') && $t.data(S2_GUARD_KEY)) {
              return;
            }
          } catch (e0) {}
          field.onChange.call(this, readVal(container, field), readData($t), e);
        });
      } else {
        $el.off('change.formui');
      }


      // auto re-validate invalid fields on user input/change
      // If a field was marked invalid, once user fixes it,
      // validate only this field and clear error UI if OK.
      if (typeof validateField === 'function') {
        var autoOpt = (options.autoValidateInvalid !== false); // default: true
        if (autoOpt) {
          var autoOptions = options.autoValidateInvalidOptions
            ? options.autoValidateInvalidOptions
            : { showErrors: true, stopOnFirstError: true };

          $el.off('input.formuiAutoValidate change.formuiAutoValidate')
            .on('input.formuiAutoValidate change.formuiAutoValidate', function () {
              var $t = $(this);
              try {
                // Ignore programmatic Select2 changes while Values.setValues is syncing
                if ($t && $t.hasClass('select2') && $t.data('select2') && $t.data(S2_GUARD_KEY)) return;
              } catch (e0) {}

              // Determine "currently invalid" state
              var isInvalid = false;
              try {
                if ($t.attr('aria-invalid') === 'true') isInvalid = true;
                else {
                  var $col = $t.closest('[class*="col-"]');
                  if ($col.length && $col.hasClass('has-error')) isInvalid = true;
                }
              } catch (e1) {}

              if (!isInvalid) return;
              // Validate only this field; validateField will clear error UI if OK
              validateField(container, field, fields, autoOptions);
            });
        } else {
          $el.off('input.formuiAutoValidate change.formuiAutoValidate');
        }
      }

      // custom events map: field.events = { keyup: fn, ... }
      if (field.events && typeof field.events === 'object') {
        Object.keys(field.events).forEach(function (evt) {
          var fn = field.events[evt];
          if (typeof fn !== 'function') return;
          $el.off(evt + '.formui').on(evt + '.formui', function (e) {
            var $t = $(this);
            return fn.call(this, e, readVal(container, field), readData($t), field);
          });
        });
      }

      // validate-on-blur (optional)
      var vOpt = (field.validateOnBlur === true) || inArr(options.validateOnBlurFields, field.id);
      if (vOpt && typeof validateField === 'function') {
        var blurOptions = options.validateOnBlurOptions ? options.validateOnBlurOptions : { showErrors: true };
        $el.off('blur.formuiValidate').on('blur.formuiValidate', function () {
          // IMPORTANT: validateField expects (container, fieldOrId, fields, options)
          validateField(container, field, fields, blurOptions);
        });
      } else {
        $el.off('blur.formuiValidate');
      }
    });
  }

  function detachFieldEvents(container) {
    if (!hasJQ || !hasJQ()) return;
    global.jQuery(container).find('input,select,textarea,button,[id]').off('.formui');
  }

  FormUI.Events = {
    attach: attachFieldEvents,
    detach: detachFieldEvents
  };

  // backward compat
  FormUI.attachFieldEvents = attachFieldEvents;
  FormUI.detachFieldEvents = detachFieldEvents;

})(this);