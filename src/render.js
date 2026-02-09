/* render.js — главный orchestrator FormUI */
(function (global) {
  'use strict';

  var FormUI = global.FormUI = global.FormUI || {};

  // deps
  var Layout = FormUI.Layout;
  var Events = FormUI.Events;
  var Fields = FormUI.Fields;
  var Select2 = FormUI.Select2;
  var Helpers = FormUI.Helpers || {};
  var Table = FormUI.Table;

  /**
   * render(container, fields, layout, actions, options, breakpoint)
   *
   * Последовательность:
   * 1) detach events
   * 2) flatten fields
   * 3) prune select2 registry
   * 4) render layout
   * 5) attach select2
   * 6) attach events
   * 7) enable enter-to-search
   */
  function render(container, fields, layout, actions, options, breakpoint) {
    // Ensure container exists: if selector/id not found, create it at end of <body>
    (function ensureContainer() {
      if (!container) return;
      // If DOM element passed directly
      if (container.nodeType === 1) return;

      if (typeof container === 'string') {
        var sel = container.trim();
        // normalize "id" -> "#id" (only if looks like a plain id, not a complex selector)
        if (sel && sel.charAt(0) !== '#' && /^[A-Za-z][\w\-:.]*$/.test(sel)) {
          sel = '#' + sel;
          container = sel;
        }
        var el = null;

        try {
          el = document.querySelector(sel);
        } catch (e) {
          el = null;
        }

        if (!el) {
          // derive id
          var id = sel[0] === '#' ? sel.slice(1) : sel;
          if (!id) return;

          el = document.createElement('div');
          el.id = id;
          document.body.appendChild(el);
        }
      }
    })();

    options = options || {};

    // 1) detach events before rerender
    if (options.bindEvents !== false && Events && Events.detach) {
      Events.detach(container);
    }

    // 2) flatten fields (expand slot.fields)
    var allFields = Fields && Fields.flatten
      ? Fields.flatten(fields)
      : (fields || []);

    // 3) prevent select2 registry growth
    if (options.select2 && Select2 && Select2.pruneRegistry) {
      Select2.pruneRegistry(allFields);
    }

    if (Table && Table.detach) Table.detach(container);

    // 4) render layout/grid
    if (!Layout || typeof Layout.render !== 'function') {
      throw new Error('FormUI.Layout.render is not available');
    }
    Layout.render(container, fields, layout, actions, breakpoint, options);

    // Apply initial hidden (hide whole field wrapper: label + control)
    // We do it AFTER Layout.render so DOM exists and Helpers.hide can target bootstrap-col root.
    if (Helpers && typeof Helpers.hide === 'function') {
      (function walk(list) {
        (list || []).forEach(function (f) {
          if (!f) return;
          if (f.id && f.hidden === true) {
            try { Helpers.hide(container, f.id); } catch (e) {}
          }
          // slot contains nested fields
          if (f.type === 'slot' && Array.isArray(f.fields)) {
            walk(f.fields);
          }
        });
      })(fields);
    }

    if (Table && Table.attach) Table.attach(container, fields, options);

    // 5) attach select2
    if (options.select2 && Select2 && Select2.attach) {
      var s2opts = (options.select2 === true) ? {} : options.select2;
      Select2.attach(container, s2opts);
    }

    // 6) attach field events
    if (options.bindEvents !== false && Events && Events.attach) {
      Events.attach(container, allFields, options);
    }

    // 7) enter-to-search helper
    if (options.enterToSearchButtonId && Helpers.enableEnterToSearch) {
      Helpers.enableEnterToSearch(container, options.enterToSearchButtonId);
    }
  }

  // export
  FormUI.render = render;

})(this);