/* select2.js — registry + attach/detach + prune/clear */
(function (global) {
  'use strict';

  var FormUI = global.FormUI = global.FormUI || {};
  var env = FormUI.env || {};
  var hasJQ = env.hasJQ || function(){ return !!global.jQuery; };
  var hasSelect2 = env.hasSelect2 || function(){ return hasJQ() && typeof global.jQuery.fn.select2 === 'function'; };

  // shared registry (configs by field id)
  var Select2 = FormUI.Select2 = FormUI.Select2 || {};
  Select2.registry = Select2.registry || {};
  var registry = Select2.registry;

  function clearRegistry(){
    Object.keys(registry).forEach(function(k){ delete registry[k]; });
  }

  // Keep only registry entries for ids present in current fields list
  function pruneRegistry(fields){
    var keep = {};
    (fields||[]).forEach(function(f){ if(f && f.id) keep[f.id] = true; });
    Object.keys(registry).forEach(function(k){
      if(!keep[k]) delete registry[k];
    });
  }

  function attach(container, defaults){
    if(!hasSelect2()) return;
    var $ = global.jQuery;
    var $root = $(container);

    $root.find('select.select2, input[type=hidden].select2').each(function(){
      var $el = $(this);
      if ($el.data('select2')) return;

      var id = this.id;
      var opts = {};

      if (defaults) $.extend(true, opts, defaults);
      if (id && registry[id]) $.extend(true, opts, registry[id]);

      $el.select2(opts);
    });
  }

  function detach(container){
    if(!hasSelect2()) return;
    var $ = global.jQuery;

    $(container).find('select.select2, input[type=hidden].select2').each(function(){
      var $el = $(this);
      if ($el.data('select2')) {
        try { $el.select2('destroy'); }
        catch(e){
          try { $el.removeData('select2'); } catch(e2){}
        }
      }
    });
  }

  // export
  Select2.attach = attach;
  Select2.detach = detach;
  Select2.pruneRegistry = pruneRegistry;
  Select2.clearRegistry = clearRegistry;

  // backward compat (как в исходнике)
  FormUI.attachSelect2 = attach;
  FormUI.detachSelect2 = detach;
  FormUI.clearSelect2Registry = clearRegistry;
  FormUI.pruneSelect2Registry = pruneRegistry;
  FormUI._select2Registry = registry;

})(this);