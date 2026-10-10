/*
 * Site behaviour: theme toggle, menu sheet, code copy buttons.
 * No dependencies; everything degrades to plain HTML when this does not run
 * (the OS colour scheme still applies and the menu is a native <details>).
 */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---- Theme: auto (follow the OS) -> dark -> light -> auto ---------------- */

  var THEME_KEY = 'fp-theme';
  var MODES = ['auto', 'dark', 'light'];
  var LABELS = { auto: 'Auto', dark: 'Dark', light: 'Light' };
  var toggle = document.getElementById('theme-toggle');

  function storedMode() {
    try {
      var value = localStorage.getItem(THEME_KEY);
      return value === 'dark' || value === 'light' ? value : 'auto';
    } catch (err) {
      return 'auto';
    }
  }

  function applyMode(mode, persist) {
    if (mode === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', mode);
    }

    if (persist) {
      try {
        if (mode === 'auto') {
          localStorage.removeItem(THEME_KEY);
        } else {
          localStorage.setItem(THEME_KEY, mode);
        }
      } catch (err) {
        /* Private mode: the choice simply will not persist. */
      }
    }

    if (toggle) {
      toggle.querySelector('.theme-label').textContent = LABELS[mode];
      toggle.setAttribute('aria-label', 'Theme: ' + LABELS[mode].toLowerCase() + '. Click to change.');
    }
  }

  if (toggle) {
    var mode = storedMode();
    applyMode(mode, false);
    toggle.hidden = false;
    toggle.addEventListener('click', function () {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      applyMode(mode, true);
    });
  }

  /* ---- Menu: close on Escape / outside click, lock scroll when full screen -- */

  var menu = document.getElementById('site-menu');

  if (menu) {
    var narrow = window.matchMedia('(max-width: 800px)');

    var syncMenu = function () {
      document.body.classList.toggle('menu-open', menu.open && narrow.matches);
    };

    menu.addEventListener('toggle', syncMenu);
    narrow.addEventListener('change', syncMenu);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    });

    document.addEventListener('click', function (event) {
      if (menu.open && !menu.contains(event.target)) {
        menu.open = false;
      }
    });

    /* Coming back from the bfcache must not show an open sheet. */
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) {
        menu.open = false;
      }
    });
  }

  /* ---- Code blocks: copy button -------------------------------------------- */

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (err) {
        ok = false;
      }
      document.body.removeChild(area);
      return ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  function flash(button, label) {
    button.textContent = label;
    window.setTimeout(function () {
      button.textContent = 'Copy';
    }, 2000);
  }

  if (document.body.dataset.codeCopy === 'true') {
    document.querySelectorAll('.prose pre').forEach(function (pre) {
      /* With line numbers on, Hugo renders a table: skip the number gutter. */
      var cell = pre.closest('td');
      if (cell && cell === cell.parentNode.firstElementChild) {
        return;
      }

      var holder = pre.closest('.highlight');
      if (!holder) {
        holder = document.createElement('div');
        holder.className = 'highlight';
        pre.parentNode.insertBefore(holder, pre);
        holder.appendChild(pre);
      }
      if (holder.querySelector('.copy-code')) {
        return;
      }

      var source = pre.querySelector('code') || pre;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'copy-code';
      button.textContent = 'Copy';
      button.setAttribute('aria-label', 'Copy code');
      button.addEventListener('click', function () {
        copyText(source.textContent).then(
          function () {
            flash(button, 'Copied');
          },
          function () {
            flash(button, 'Failed');
          }
        );
      });
      holder.appendChild(button);
    });
  }
})();
