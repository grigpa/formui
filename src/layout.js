/* layout.js — grid / groups / fieldsets / EMPTY */
(function (global) {
  'use strict';

  var FormUI = global.FormUI = global.FormUI || {};

  // deps
  var env = FormUI.env || {};
  var rootEl = env.rootEl;

  var Controls = FormUI.Controls;
  if (!Controls) {
    throw new Error('FormUI.Controls is required (load fields.js before layout.js)');
  }

  // utils (fallbacks)
  function cls(a,b){ if(!a) return b||''; if(!b) return a; return a+' '+b; }

  // DOM helpers (prefer globals, fallback to dom.h)
  var dom = FormUI.dom || {};
  function TAG(name){
    return function(){
      if (typeof global[name.toUpperCase()] === 'function') {
        return global[name.toUpperCase()].apply(null, arguments);
      }
      if (!dom.h) throw new Error('FormUI.dom.h is required');
      return dom.h.apply(null, [name].concat([].slice.call(arguments)));
    };
  }
  var DIV = TAG('div');
  var LABEL = TAG('label');
  var FIELDSET = TAG('fieldset');
  var LEGEND = TAG('legend');

  /* =========================
   * EMPTY sentinel
   * ========================= */
  var EMPTY = { __formui_empty: true };

  /* =========================
   * Layout renderer
   * ========================= */
  function renderFieldsBootstrapGrid(container, fields, layout, actions, breakpoint, options){
    var root = rootEl ? rootEl(container) : container;
    if(!root) return;

    breakpoint = breakpoint || 'md';
    options = options || {};
    root.innerHTML = '';

    var used = {};
    var cursor = 0;

    function takeNext(){
      while(cursor < fields.length){
        var f = fields[cursor++];
        if (f && !used[f.id]) return f;
      }
      return null;
    }
    function showLabel(f){
      if(!f || f.noLabel) return false;
      if(f.type==='checkbox'||f.type==='radio') return false;
      if(f.type==='checkboxes'||f.type==='radios') return true;
      if(f.type==='button'||f.type==='custom') return false;
      if(f.type==='slot') return false;
      if (f.type === 'table') return false;
      return true;
    }

    function renderRow(rowFields, target, expectedCols){
      if(!rowFields || !rowFields.length) return;

      var colsCount = expectedCols || rowFields.length || 1;
      var col = Math.floor(12 / colsCount) || 12;

      var cols = rowFields.map(function(f){
        // empty cell
        if (!f || f === EMPTY) {
          return DIV({class:'col-' + breakpoint + '-' + col}, '');
        }

        used[f.id] = true;

        var ctl =
          (f.type === 'checkboxes') ? Controls.renderCheckboxesList(f)
          : (f.type === 'radios') ? Controls.renderRadiosList(f)
          : Controls.create(f, { breakpoint: breakpoint, options: options });

        var content;
        if (f.type === 'checkbox') {
          content = Controls.renderCheckboxInline(f, ctl);
        } else if (f.type === 'radio') {
          content = Controls.renderRadioInline(f, ctl);
        } else {
          content = [
            showLabel(f) ? LABEL({ for:f.id, 'class':'control-label' }, f.label || '') : null,
            ctl
          ];
        }

        return DIV({class:'col-' + breakpoint + '-' + col}, content);
      });

      target.appendChild(
        DIV({class:'form-group formui-row'}, cols)
      );
    }

    function processRows(rows, target){
      (rows||[]).forEach(function(row){

        // number = N columns
        if(typeof row === 'number'){
          var arr = [];
          for(var i=0;i<row;i++){
            var f = takeNext();
            if(f) arr.push(f);
          }
          renderRow(arr, target, row);
          return;
        }

        // array = explicit row
        if(Array.isArray(row)){
          var picked = row.map(function(cell){
            if (cell == null) return null;
            if (cell === EMPTY) return null;
            if (typeof cell === 'string') {
              for (var j=0;j<fields.length;j++){
                if (fields[j] && fields[j].id === cell) return fields[j];
              }
            }
            return null;
          });
          renderRow(picked, target, row.length);
          return;
        }

        // object = group / fieldset
        if(row && typeof row === 'object'){

          if(row.type === 'group'){
            var inner = document.createDocumentFragment();
            processRows(row.rows || [], inner);

            var a = row.attrs || {};
            if (row.id && !a.id) a.id = row.id;
            a.class = cls(a.class || '', 'form-ui-group ' + (row.class || ''));

            target.appendChild(DIV(a, inner));
            return;
          }

          if(row.type === 'fieldset'){
            var inner2 = document.createDocumentFragment();
            processRows(row.rows || [], inner2);

            var fs = row.attrs || {};
            if (row.id && !fs.id) fs.id = row.id;
            fs.class = cls(fs.class || '', 'form-ui-fieldset ' + (row.class || ''));

            target.appendChild(
              FIELDSET(fs, row.legend ? LEGEND(row.legend) : null, inner2)
            );
            return;
          }
        }
      });
    }

    var frag = document.createDocumentFragment();

    if(typeof layout === 'number'){
      var step = Math.max(1, layout);
      for(var i=0;i<fields.length;i+=step){
        renderRow(fields.slice(i, i+step), frag, step);
      }
    }
    else if(layout && Array.isArray(layout.rows)){
      processRows(layout.rows, frag);
      var rest = fields.filter(function(f){ return !used[f.id]; });
      if(rest.length) renderRow(rest, frag);
    }
    else {
      renderRow(fields.slice(), frag);
    }

    /* ===== actions row ===== */
    if(actions && actions.length){
      var align = options.actionsAlign || 'left';
      var alignClass =
        (align==='right') ? 'text-right' :
        (align==='center') ? 'text-center' : 'text-left';

      var btns = actions.map(function(a){
        return BUTTON(
          { id:a.id, class:a.class||'btn btn-default', type:a.type||'button', onclick:a.onClick },
          a.text || ''
        );
      });

      frag.appendChild(
        DIV({class:'form-group formui-row'},
          DIV({class:'col-' + breakpoint + '-12 form-actions-row ' + alignClass},
            DIV({class:'formui-actions-inline'}, btns)
          )
        )
      );
    }

    root.appendChild(
      DIV({class:'form-ui-scope'}, frag)
    );
  }

  /* =========================
   * export
   * ========================= */
  FormUI.Layout = {
    render: renderFieldsBootstrapGrid,
    EMPTY: EMPTY
  };

  // backward compatibility
  FormUI.renderFieldsBootstrapGrid = renderFieldsBootstrapGrid;
  FormUI.EMPTY = EMPTY;

})(this);