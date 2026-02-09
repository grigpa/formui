/* facade.js — public FormUI API (compat with original form-ui.js) */
(function (global) {
  'use strict';

  var FormUI = global.FormUI = global.FormUI || {};

  // modules (may be loaded before/after; we map if present)
  var Layout = FormUI.Layout || {};
  var Select2 = FormUI.Select2 || {};
  var Events = FormUI.Events || {};
  var Values = FormUI.Values || {};
  var Validation = FormUI.Validation || {};
  var Fields = FormUI.Fields || {};
  var Helpers = FormUI.Helpers || {};
  var Table = FormUI.Table || {};
  var dom = FormUI.dom || {};

  // ---- Core render API ----
  // render() should be defined in render.js; do not override if already set
  // FormUI.render = FormUI.render || function(){...}  // (не задаём здесь)

  // ---- Layout ----
  if (!FormUI.renderFieldsBootstrapGrid && typeof Layout.render === 'function') {
    FormUI.renderFieldsBootstrapGrid = Layout.render;
  }
  if (!FormUI.EMPTY && Layout.EMPTY) {
    FormUI.EMPTY = Layout.EMPTY;
  }

  // ---- Select2 ----
  if (!FormUI.attachSelect2 && typeof Select2.attach === 'function') {
    FormUI.attachSelect2 = Select2.attach;
  }
  if (!FormUI.detachSelect2 && typeof Select2.detach === 'function') {
    FormUI.detachSelect2 = Select2.detach;
  }
  if (!FormUI.clearSelect2Registry && typeof Select2.clearRegistry === 'function') {
    FormUI.clearSelect2Registry = Select2.clearRegistry;
  }
  if (!FormUI.pruneSelect2Registry && typeof Select2.pruneRegistry === 'function') {
    FormUI.pruneSelect2Registry = Select2.pruneRegistry;
  }

  // legacy internal name (как в исходнике)
  if (!FormUI._select2Registry) {
    if (Select2.registry) FormUI._select2Registry = Select2.registry;
    else if (FormUI.Select2 && FormUI.Select2.registry) FormUI._select2Registry = FormUI.Select2.registry;
  }

  // ---- Events ----
  if (!FormUI.attachFieldEvents && typeof Events.attach === 'function') {
    FormUI.attachFieldEvents = Events.attach;
  }
  if (!FormUI.detachFieldEvents && typeof Events.detach === 'function') {
    FormUI.detachFieldEvents = Events.detach;
  }

  // ---- Values ----
  if (!FormUI.setValues && typeof Values.set === 'function') {
    FormUI.setValues = Values.set;
  }
  if (!FormUI.getValues && typeof Values.get === 'function') {
    FormUI.getValues = Values.get;
  }
  if (!FormUI.getValue && typeof Values.getValue === 'function') {
    FormUI.getValue = Values.getValue;
  }
  if (!FormUI.clearValues && typeof Values.clear === 'function') {
    FormUI.clearValues = Values.clear;
  }
  if (!FormUI.setDisable && typeof Values.setDisable === 'function') {
    FormUI.setDisable = Values.setDisable;
  }
  if (!FormUI.setDisabled && typeof Values.setDisabled === 'function') {
    FormUI.setDisabled = Values.setDisabled;
  }
  if (!FormUI.clearDisabled && typeof Values.clearDisabled === 'function') {
    FormUI.clearDisabled = Values.clearDisabled;
  }

  // ---- Validation ----
  if (!FormUI.registerValidator && typeof Validation.registerValidator === 'function') {
    FormUI.registerValidator = Validation.registerValidator;
  }
  if (!FormUI.validate && typeof Validation.validate === 'function') {
    FormUI.validate = Validation.validate;
  }
  if (!FormUI.validateField && typeof Validation.validateField === 'function') {
    FormUI.validateField = Validation.validateField;
  }
  if (!FormUI.validateGroup && typeof Validation.validateGroup === 'function') {
    FormUI.validateGroup = Validation.validateGroup;
  }
  if (!FormUI.clearErrors && typeof Validation.clearErrors === 'function') {
    FormUI.clearErrors = Validation.clearErrors;
  }
  if (!FormUI.setErrors && typeof Validation.setErrors === 'function') {
    FormUI.setErrors = Validation.setErrors;
  }
  if (!FormUI.validators && Validation.validators) {
    FormUI.validators = Validation.validators;
  }

  // ---- DOM helpers ----
  if (!FormUI.dom && dom) {
    FormUI.dom = dom; // { h, toNode }
  }

  // ---- Field factories (compat) ----
  if (!FormUI.createAjaxSelect && typeof Fields.createAjaxSelect === 'function') {
    FormUI.createAjaxSelect = Fields.createAjaxSelect;
  }

  // ---- QueryTable integration (type:'table') ----
  if (!FormUI.attachTables && typeof Table.attach === 'function') {
    FormUI.attachTables = Table.attach;
  }
  if (!FormUI.detachTables && typeof Table.detach === 'function') {
    FormUI.detachTables = Table.detach;
  }

  // ---- QueryTable runtime API ----
  if (!FormUI.getTable && typeof Table.get === 'function') {
    FormUI.getTable = Table.get;
  }
  if (!FormUI.reloadTable && typeof Table.reload === 'function') {
    FormUI.reloadTable = Table.reload;
  }
  if (!FormUI.reloadTableByField && typeof Table.reloadByField === 'function') {
    FormUI.reloadTableByField = Table.reloadByField;
  }

  // ---- Element helpers (getEl/show/hide) ----
  if (!FormUI.getEl && typeof Helpers.getEl === 'function') {
    FormUI.getEl = Helpers.getEl;
  }
  if (!FormUI.hide && typeof Helpers.hide === 'function') {
    FormUI.hide = Helpers.hide;
  }
  if (!FormUI.show && typeof Helpers.show === 'function') {
    FormUI.show = Helpers.show;
  }
  if (!FormUI.toggle && typeof Helpers.toggle === 'function') {
    FormUI.toggle = Helpers.toggle;
  }
  if (!FormUI.isVisible && typeof Helpers.isVisible === 'function') {
    FormUI.isVisible = Helpers.isVisible;
  }

  if (!FormUI.renderModal && FormUI.Modal && FormUI.Modal.render) FormUI.renderModal = FormUI.Modal.render;
  if (!FormUI.showModal && FormUI.Modal && FormUI.Modal.show) FormUI.showModal = FormUI.Modal.show;
  if (!FormUI.hideModal && FormUI.Modal && FormUI.Modal.hide) FormUI.hideModal = FormUI.Modal.hide;

})(this);