/* Hive & Leaf theme scripts. Plain vanilla JS, no dependencies. */
(function () {
  'use strict';

  var mobileQuery = window.matchMedia ? window.matchMedia('(max-width: 767px)') : null;
  var reduceMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function addQueryListener(query, fn) {
    if (!query) return;
    if (query.addEventListener) {
      query.addEventListener('change', fn);
    } else if (query.addListener) {
      query.addListener(fn);
    }
  }

  function toArray(list) {
    return Array.prototype.slice.call(list || []);
  }

  /* ---------- Announcement bar rotation ---------- */

  function initAnnouncementBars() {
    toArray(document.querySelectorAll('[data-announcement-bar]')).forEach(function (bar) {
      var items = toArray(bar.querySelectorAll('[data-announcement-item]'));
      if (items.length < 2) return;
      if (reduceMotionQuery && reduceMotionQuery.matches) return;

      var interval = parseInt(bar.getAttribute('data-interval'), 10) || 5000;
      var current = 0;

      window.setInterval(function () {
        items[current].hidden = true;
        current = (current + 1) % items.length;
        items[current].hidden = false;
      }, interval);
    });
  }

  /* ---------- Header: mobile navigation, scroll shadow ---------- */

  function initHeader() {
    toArray(document.querySelectorAll('[data-site-header]')).forEach(function (header) {
      var nav = header.querySelector('[data-nav]');
      var openBtn = header.querySelector('[data-nav-open]');
      var closeBtn = header.querySelector('[data-nav-close]');
      var overlay = header.querySelector('[data-nav-overlay]');

      function isNavOpen() {
        return !!nav && nav.classList.contains('is-open');
      }

      function openNav() {
        if (!nav) return;
        nav.classList.add('is-open');
        if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
        if (overlay) overlay.hidden = false;
        document.body.classList.add('is-nav-locked');
        if (closeBtn) closeBtn.focus();
      }

      function closeNav(returnFocus) {
        if (!nav) return;
        nav.classList.remove('is-open');
        if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
        if (overlay) overlay.hidden = true;
        document.body.classList.remove('is-nav-locked');
        if (returnFocus && openBtn) openBtn.focus();
      }

      if (openBtn) openBtn.addEventListener('click', openNav);
      if (closeBtn) closeBtn.addEventListener('click', function () { closeNav(true); });
      if (overlay) overlay.addEventListener('click', function () { closeNav(true); });

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && isNavOpen()) closeNav(true);
      });

      addQueryListener(mobileQuery, function () {
        // Leaving the mobile layout: the desktop nav is always visible, so reset the panel state.
        if (mobileQuery && !mobileQuery.matches && isNavOpen()) closeNav(false);
      });

      function onScroll() {
        header.classList.toggle('is-scrolled', (window.pageYOffset || document.documentElement.scrollTop || 0) > 8);
      }

      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    });
  }

  /* ---------- Cart: Ajax API helpers ---------- */

  function request(url, options) {
    options = options || {};
    options.headers = Object.assign({ Accept: 'application/json' }, options.headers || {});
    return fetch(url, options).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) {
          throw new Error(data.description || data.message || 'Something went wrong. Please try again.');
        }
        return data;
      });
    });
  }

  function formatMoney(cents, currency) {
    var drawerEl = document.querySelector('[data-cart-drawer]');
    var format = drawerEl && drawerEl.getAttribute('data-money-format');
    var value = Number(cents || 0) / 100;
    if (format) {
      return format.replace(/\{\{\s*(\w+)\s*\}\}/, function (_, key) {
        var parts = value.toFixed(/no_decimals/.test(key) ? 0 : 2).split('.');
        var sep = /comma_separator/.test(key) ? ['.', ','] : [',', '.'];
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep[0]);
        return parts.join(sep[1]);
      });
    }
    return value.toFixed(2) + (currency ? ' ' + currency : '');
  }

  function sizedImage(src, width) {
    if (!src) return '';
    var separator = src.indexOf('?') > -1 ? '&' : '?';
    return src + separator + 'width=' + width;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /* ---------- Cart drawer and add-to-cart ---------- */

  function initCart() {
    var drawer = document.querySelector('[data-cart-drawer]');
    if (!drawer) return;

    var overlay = document.querySelector('[data-cart-overlay]');
    var itemsEl = drawer.querySelector('[data-cart-items]');
    var emptyEl = drawer.querySelector('[data-cart-empty]');
    var footEl = drawer.querySelector('[data-cart-foot]');
    var subtotalEl = drawer.querySelector('[data-cart-subtotal]');
    var errorEl = drawer.querySelector('[data-cart-error]');
    var closeBtn = drawer.querySelector('[data-cart-close]');
    var currency = drawer.getAttribute('data-currency') || '';
    var isOpen = false;
    var lastFocus = null;

    function setBusy(busy) {
      drawer.classList.toggle('is-busy', busy);
      drawer.setAttribute('aria-busy', busy ? 'true' : 'false');
    }

    function showError(error) {
      if (errorEl) {
        errorEl.textContent = error && error.message ? error.message : 'Something went wrong. Please try again.';
        errorEl.hidden = false;
      }
      setBusy(false);
      openDrawer();
    }

    function clearError() {
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.hidden = true;
      }
    }

    function updateCounts(count) {
      toArray(document.querySelectorAll('[data-cart-count]')).forEach(function (node) {
        node.textContent = String(count);
        node.hidden = count === 0;
      });
    }

    function buildItem(item, index) {
      var line = String(index + 1);
      var title = item.product_title || item.title || '';
      var li = el('li', 'cart-drawer__item');
      li.setAttribute('data-cart-line', line);

      var media = el('div', 'cart-drawer__media');
      if (item.image) {
        var img = el('img');
        img.src = sizedImage(item.image, 160);
        img.alt = '';
        img.loading = 'lazy';
        media.appendChild(img);
      } else {
        media.appendChild(el('span', 'cart-drawer__media-empty'));
      }

      var info = el('div', 'cart-drawer__info');
      var product = el('a', 'cart-drawer__product', title);
      product.href = item.url;
      info.appendChild(product);

      if (item.variant_title && item.variant_title !== 'Default Title') {
        info.appendChild(el('p', 'cart-drawer__variant', item.variant_title));
      }

      var row = el('div', 'cart-drawer__row');
      var qty = el('div', 'cart-drawer__qty');
      qty.setAttribute('role', 'group');
      qty.setAttribute('aria-label', 'Quantity for ' + title);

      var dec = el('button', null, '−');
      dec.type = 'button';
      dec.setAttribute('data-cart-qty', '');
      dec.setAttribute('data-line', line);
      dec.setAttribute('data-delta', '-1');
      dec.setAttribute('data-quantity', String(item.quantity));
      dec.setAttribute('aria-label', 'Decrease quantity');

      var value = el('span', 'cart-drawer__qty-value', String(item.quantity));
      value.setAttribute('aria-live', 'polite');

      var inc = el('button', null, '+');
      inc.type = 'button';
      inc.setAttribute('data-cart-qty', '');
      inc.setAttribute('data-line', line);
      inc.setAttribute('data-delta', '1');
      inc.setAttribute('data-quantity', String(item.quantity));
      inc.setAttribute('aria-label', 'Increase quantity');

      qty.appendChild(dec);
      qty.appendChild(value);
      qty.appendChild(inc);
      row.appendChild(qty);
      row.appendChild(el('span', 'cart-drawer__price', formatMoney(item.final_line_price, currency)));
      info.appendChild(row);

      var remove = el('button', 'cart-drawer__remove', 'Remove');
      remove.type = 'button';
      remove.setAttribute('data-cart-remove', '');
      remove.setAttribute('data-line', line);
      remove.setAttribute('aria-label', 'Remove ' + title);
      info.appendChild(remove);

      li.appendChild(media);
      li.appendChild(info);
      return li;
    }

    function render(cart) {
      if (!cart) return;
      if (cart.currency) currency = cart.currency;

      var items = cart.items || [];
      var count = cart.item_count !== undefined ? cart.item_count : items.length;
      var isEmpty = count === 0 || items.length === 0;

      updateCounts(count);

      if (itemsEl) {
        while (itemsEl.firstChild) itemsEl.removeChild(itemsEl.firstChild);
        items.forEach(function (item, index) {
          itemsEl.appendChild(buildItem(item, index));
        });
        itemsEl.hidden = isEmpty;
      }
      if (emptyEl) emptyEl.hidden = !isEmpty;
      if (footEl) footEl.hidden = isEmpty;
      if (subtotalEl) subtotalEl.textContent = formatMoney(cart.total_price, currency);
    }

    function refreshCart() {
      return request('/cart.js').then(render);
    }

    function changeLine(line, quantity) {
      clearError();
      setBusy(true);
      return request('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line: line, quantity: quantity })
      }).then(function (cart) {
        render(cart);
        setBusy(false);
      }).catch(showError);
    }

    function getFocusable() {
      return toArray(drawer.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])'))
        .filter(function (node) { return node.closest('[hidden]') === null; });
    }

    function openDrawer() {
      if (isOpen) return;
      isOpen = true;
      lastFocus = document.activeElement;
      drawer.classList.add('is-open');
      if (overlay) overlay.classList.add('is-open');
      document.body.classList.add('is-cart-open');
      (closeBtn || drawer).focus();
    }

    function closeDrawer() {
      if (!isOpen) return;
      isOpen = false;
      drawer.classList.remove('is-open');
      if (overlay) overlay.classList.remove('is-open');
      document.body.classList.remove('is-cart-open');
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }

    // Header cart link: open the drawer instead of navigating (plain link still works without JS).
    toArray(document.querySelectorAll('[data-cart-open]')).forEach(function (trigger) {
      trigger.addEventListener('click', function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
        event.preventDefault();
        openDrawer();
        clearError();
        refreshCart().catch(showError);
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (overlay) overlay.addEventListener('click', closeDrawer);

    // Quantity and remove buttons (event delegation, so re-rendered rows keep working).
    drawer.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var removeBtn = target.closest('[data-cart-remove]');
      var qtyBtn = target.closest('[data-cart-qty]');
      if (removeBtn) {
        event.preventDefault();
        changeLine(Number(removeBtn.getAttribute('data-line')), 0);
      } else if (qtyBtn) {
        event.preventDefault();
        var current = Number(qtyBtn.getAttribute('data-quantity')) || 0;
        var delta = Number(qtyBtn.getAttribute('data-delta')) || 0;
        var next = Math.max(0, current + delta);
        changeLine(Number(qtyBtn.getAttribute('data-line')), next);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }

      // Keep keyboard focus inside the drawer while it is open.
      if (event.key === 'Tab') {
        var focusable = getFocusable();
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        var active = document.activeElement;
        var inside = drawer.contains(active);

        if (event.shiftKey && (active === first || !inside)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !inside)) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    // Product forms: add through the Ajax API and show the drawer.
    document.addEventListener('submit', function (event) {
      var form = event.target;
      if (!form || !form.matches || !form.matches('form[action$="/cart/add"]')) return;
      if (form.getAttribute('data-adding') === 'true') {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      form.setAttribute('data-adding', 'true');
      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      clearError();
      setBusy(true);

      function done() {
        form.removeAttribute('data-adding');
        if (submitBtn) submitBtn.disabled = false;
        setBusy(false);
      }

      request('/cart/add.js', { method: 'POST', body: new FormData(form) })
        .then(function () {
          return request('/cart.js');
        })
        .then(function (cart) {
          render(cart);
          done();
          openDrawer();
          document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: cart } }));
        })
        .catch(function (error) {
          done();
          showError(error);
        });
    });
  }

  onReady(function () {
    initAnnouncementBars();
    initHeader();
    initCart();
  });
})();
