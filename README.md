# FormUI

FormUI is a modular client-side form rendering and behavior library built on top of jQuery and Bootstrap-style layouts.  
It provides declarative form configuration, validation, Select2 integration, QueryTable integration, modal helpers, and jQuery UI date/datetime pickers.

This README reflects the current fixed architecture and API contracts.

---

# Core Features

- Declarative form schema (fields, layout, actions)
- Modular architecture (IIFE modules, fixed load order)
- Validation with custom validators
- Select2 ajax integration (guarded change)
- QueryTable integration (type: table)
- Slot containers with title + actions
- Show / hide / toggle helpers
- Disabled helpers (including radios & checkboxes)
- Modal rendering
- jQuery UI date & datetime picker
- Scoped API (FormUI.scope)

---

# Module Structure

core.js  
fields.js  
layout.js  
select2.js  
values.js  
validation.js  
events.js  
helpers.js  
render.js  
facade.js  

## Required Load Order

```html
<script src="core.js"></script>
<script src="fields.js"></script>
<script src="layout.js"></script>
<script src="select2.js"></script>
<script src="values.js"></script>
<script src="validation.js"></script>
<script src="events.js"></script>
<script src="helpers.js"></script>
<script src="render.js"></script>
<script src="facade.js"></script>
```

---

# Basic Usage

```js
const fields = [
  { id: 'name', label: 'Name', type: 'text', required: true },
  { id: 'email', label: 'Email', type: 'email' }
];

FormUI.render('#form', fields);
FormUI.setValues('#form', { name: 'John' });
const data = FormUI.getValues('#form');
```

---

# Field Types

text, textarea, checkbox, checkboxes, radios, select,  
select2-ajax, datetimepicker, table, slot, label, custom

---

# Slot

```js
{
  type: 'slot',
  id: 'advanced',
  title: 'Advanced',
  fields: [...],
  actions: [{ text:'Reset', onClick: fn }]
}
```

---

# Visibility

```js
FormUI.show(container, id)
FormUI.hide(container, id)
FormUI.toggle(container, id)
```

Hidden is implemented via `style: display:none`.

---

# Disabled

```js
FormUI.setDisabled(container, { field:true })
FormUI.clearDisabled(container)
```

---

# Scoped API

```js
const ui = FormUI.scope('#mainForm');
ui.setValues({ a:1 });
ui.hide('fieldX');
ui.validate(fields);
```

---

# Validation

Built‑in validators:

required, email, pattern/regex, minLen, maxLen, min, max

Hidden fields are skipped unless:

```js
FormUI.validate('#form', fields, { includeHidden:true });
```

---

# Select2 Ajax

```js
FormUI.createAjaxSelect({
  id:'user',
  queryCode:'users',
  initCode:'users',
  displayProp:'name'
});
```

Single ajax on setValues, guarded change, full object in handlers.

---

# Table

```js
{
  type:'table',
  id:'accounts',
  table:{
    jspParams:{ queryTableCode:'entity_account' },
    data: () => ({ id:1 })
  }
}
```

---

# Date / DateTime Picker

Requires jQuery UI.

```js
{
  id:'date',
  type:'datetimepicker',
  datetimepicker:{ dateFormat:'dd.mm.yy' }
}
```

---

# Modal

```js
FormUI.renderModal({ id:'m', title:'Edit', formId:'mf' });
FormUI.render('#mf', fields);
FormUI.showModal('m');
```

---

# Custom Field

```js
{ type:'custom', render: () => DIV({}, 'Custom') }
```

---

# Dependencies

jQuery 3.x  
Bootstrap styles  
Select2 3.5  
jQuery UI  
QueryTable

---

# Status

API and module layout are stable.
