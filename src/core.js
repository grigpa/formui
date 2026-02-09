/* core.js — env + utils + dom (h/toNode + optional global tags) */
(function (global) {
  'use strict';

  var FormUI = global.FormUI = global.FormUI || {};

  /* =========================
   * 1) env (rootEl / hasJQ / hasSelect2 / getByIdIn)
   * ========================= */
  function rootEl(c){
    if(!c) return null;
    // unwrap jQuery objects
    if(c && c.jquery) return c[0] || null;
    return (typeof c === 'string') ? document.querySelector(c) : c;
  }

  function hasJQ(){ return !!global.jQuery; }

  function hasSelect2(){ return hasJQ() && typeof global.jQuery.fn.select2 === 'function'; }

  function getByIdIn(container, id){
    if(!id) return null;
    var root = rootEl(container);
    if(!root) return null;

    var el = document.getElementById(id);
    if(!el) return null;

    return root.contains(el) ? el : null;
  }

  FormUI.env = {
    rootEl: rootEl,
    hasJQ: hasJQ,
    hasSelect2: hasSelect2,
    getByIdIn: getByIdIn
  };

  /* =========================
   * 2) utils
   * ========================= */
  function isObj(x){ return x && typeof x === 'object' && !Array.isArray(x) && !x.nodeType; }

  function merge(a,b){
    a=a||{}; b=b||{};
    var o={};
    Object.keys(a).forEach(function(k){ o[k]=a[k]; });
    Object.keys(b).forEach(function(k){ o[k]=b[k]; });
    return o;
  }

  function cls(a,b){ if(!a) return b||''; if(!b) return a; return a+' '+b; }

  function empty(v){
    if(v==null) return true;
    if(typeof v==='string') return v.trim()==='';
    if(Array.isArray(v)) return v.length===0;
    return false;
  }

  function promiseLike(x){ return x && typeof x.then === 'function'; }

  function arr(x){ return Array.isArray(x) ? x : (x!=null ? [x] : []); }

  function inArr(a, v){
    return arr(a).map(String).indexOf(String(v)) >= 0;
  }

  FormUI.utils = {
    isObj: isObj,
    merge: merge,
    cls: cls,
    empty: empty,
    promiseLike: promiseLike,
    arr: arr,
    inArr: inArr
  };

  /* =========================
   * 3) dom (h + toNode + optional global tags)
   * ========================= */
  function h(tag, props){
    var el = document.createElement(tag);
    var start = 1;

    if(props && isObj(props)){
      Object.keys(props).forEach(function(k){
        var v = props[k];

        if(k === 'class') el.className = v;
        else if(k === 'style' && isObj(v)) Object.assign(el.style, v);
        else if(k === 'data' && isObj(v)) {
          Object.keys(v).forEach(function(dk){
            el.setAttribute('data-' + dk, v[dk]);
          });
        }
        else if(k.slice(0,2) === 'on' && typeof v === 'function'){
          el.addEventListener(k.slice(2).toLowerCase(), v);
        }
        else if(v !== false && v != null){
          el.setAttribute(k, v === true ? '' : v);
        }
      });
      start = 2;
    }

    for(var i=start;i<arguments.length;i++){
      var c = arguments[i];
      if(c == null) continue;

      if(Array.isArray(c)){
        c.forEach(function(x){
          if(!x) return;
          el.appendChild(x.nodeType ? x : document.createTextNode(String(x)));
        });
      } else {
        el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
      }
    }
    return el;
  }

  function toNode(x){
    if(x==null) return null;
    if(x.nodeType) return x;

    if(Array.isArray(x)){
      var f = document.createDocumentFragment();
      x.forEach(function(it){
        var n = toNode(it);
        if(n) f.appendChild(n);
      });
      return f;
    }

    return document.createTextNode(String(x));
  }

  FormUI.dom = {
    h: h,
    toNode: toNode
  };

  // Optional global helpers: DIV(), INPUT(), ...
  // Opt-out: set window.FormUI_NO_GLOBAL_TAGS = true before loading core.js
  var DOM_TAGS = ['div','span','label','input','select','option','textarea','button','fieldset','legend'];
  if(!global.FormUI_NO_GLOBAL_TAGS){
    DOM_TAGS.forEach(function(t){
      global[t.toUpperCase()] = function(){
        return h.apply(null, [t].concat([].slice.call(arguments)));
      };
    });
  }

})(this);