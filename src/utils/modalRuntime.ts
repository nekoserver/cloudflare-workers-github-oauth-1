/**
 * Overlay 型モーダルに共通する stack、開閉、Escape、backdrop、focus 復帰を提供する。
 * 各 view が文字列として埋め込めるよう、依存のない browser script を返す。
 */
export function getModalRuntimeScript(): string {
  return `
  (function() {
    if (window.ModalRuntime) return;

    var registrations = new Map();
    var stack = [];

    function removeFromStack(id) {
      stack = stack.filter(function(openId) { return openId !== id; });
    }

    function nextZIndex(overlay) {
      var max = 2000;
      document.querySelectorAll('[data-overlay]').forEach(function(element) {
        if (element === overlay) return;
        var z = parseInt(window.getComputedStyle(element).zIndex, 10)
          || parseInt(element.style.zIndex, 10)
          || 0;
        if (z > max) max = z;
      });
      return max + 100;
    }

    function topmost() {
      return stack.length > 0 ? stack[stack.length - 1] : null;
    }

    function register(options) {
      if (!options || !options.id || !options.overlay) {
        throw new Error('ModalRuntime.register requires id and overlay');
      }
      if (registrations.has(options.id)) return registrations.get(options.id).controller;

      var overlay = options.overlay;
      var opener = null;
      var isOpen = false;

      function bringToFront() {
        if (!isOpen) return;
        removeFromStack(options.id);
        stack.push(options.id);
        overlay.style.zIndex = String(nextZIndex(overlay));
        overlay.setAttribute('data-overlay', '');
      }

      function open() {
        opener = document.activeElement && typeof document.activeElement.focus === 'function'
          ? document.activeElement
          : null;
        isOpen = true;
        overlay.classList.add(options.openClass || 'open');
        bringToFront();
        if (options.onOpen) options.onOpen();
      }

      function close() {
        if (!isOpen) return false;
        isOpen = false;
        overlay.classList.remove(options.openClass || 'open');
        removeFromStack(options.id);
        if (options.onClose) options.onClose();
        if (options.restoreFocus !== false && opener && opener.isConnected) opener.focus();
        opener = null;
        return true;
      }

      var controller = {
        open: open,
        close: close,
        bringToFront: bringToFront,
        isOpen: function() { return isOpen; },
      };
      registrations.set(options.id, { controller: controller, options: options });

      if (options.closeOnBackdrop !== false) {
        overlay.addEventListener('click', function(event) {
          if (event.target === overlay && topmost() === options.id) close();
        });
      }
      (options.closeButtons || []).forEach(function(button) {
        if (button) button.addEventListener('click', close);
      });
      return controller;
    }

    document.addEventListener('keydown', function(event) {
      if (event.key !== 'Escape') return;
      var id = topmost();
      var registration = id ? registrations.get(id) : null;
      if (!registration || registration.options.closeOnEscape === false) return;
      event.stopPropagation();
      registration.controller.close();
    });

    window.ModalRuntime = {
      register: register,
      topmost: topmost,
      bringToFront: function(id) {
        var registration = registrations.get(id);
        if (registration) registration.controller.bringToFront();
      },
      close: function(id) {
        var registration = registrations.get(id);
        return registration ? registration.controller.close() : false;
      },
    };
  }());`;
}
