// ===============================
// Generic AutoTrack
// Captures: clicks, JS errors, backend failures
// ===============================

const codevalAutoTrackConfig = (() => {
  const dataset = document.currentScript?.dataset || {};
  return {
    mirrorEventName: dataset.mirrorEventName || dataset.eventName || 'codeval_click',
    tag: dataset.tag || 'autotrack',
    maxTextLength: Number.parseInt(dataset.maxTextLength || '480', 10)
  };
})();

function codevalGtagEvent(name, payload) {
  try {
    window.dataLayer = window.dataLayer || [];
    const sendEvent = typeof window.gtag === 'function'
      ? window.gtag
      : function() {
          window.dataLayer.push(arguments);
        };
    sendEvent('event', name, payload);
  } catch (err) {
    // Never break the user's site
  }
}

function codevalUrlInfo(value) {
  try {
    return new URL(String(value || ''), window.location.href);
  } catch (err) {
    return null;
  }
}

function codevalEndpointName(value) {
  const url = codevalUrlInfo(value);
  if (!url) return codevalCleanText(value, 160);
  if (url.origin === window.location.origin) return url.pathname || '/';
  return `${url.origin}${url.pathname}`;
}

function codevalSafeRequestUrl(value) {
  const url = codevalUrlInfo(value);
  if (!url) return codevalCleanText(value, 300);
  const sensitive = /token|secret|password|passwd|pwd|key|code|state|session|auth|credential/i;
  url.searchParams.forEach((paramValue, key) => {
    if (sensitive.test(key) || sensitive.test(paramValue)) {
      url.searchParams.set(key, '[redacted]');
    }
  });
  return codevalCleanText(url.href, 300);
}

function codevalShouldIgnoreFetch(value) {
  const url = codevalUrlInfo(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  const expectedSessionProbePaths = new Set([
    '/github/me',
    '/google-analytics/me'
  ]);
  return (
    host === 'analytics.google.com' ||
    host === 'www.google-analytics.com' ||
    host === 'google-analytics.com' ||
    host === 'www.googletagmanager.com' ||
    host === 'googletagmanager.com' ||
    host.endsWith('.google-analytics.com') ||
    host.endsWith('.googletagmanager.com') ||
    (url.origin === window.location.origin && expectedSessionProbePaths.has(url.pathname)) ||
    url.pathname === '/g/collect' ||
    url.pathname === '/collect'
  );
}

function codevalErrorNode(basePayload) {
  return codevalCleanText(
    basePayload.source_element ||
    basePayload.trigger_element ||
    basePayload.top_frame ||
    basePayload.source ||
    basePayload.function_name ||
    basePayload.endpoint_name ||
    'autotracked_error',
    160
  );
}

function codevalTrackErrorEvent(name, label, payload) {
  const basePayload = {
    ...payload,
    page_path: window.location.pathname,
    tag: codevalAutoTrackConfig.tag
  };
  const node = codevalErrorNode(basePayload);
  codevalGtagEvent(name, basePayload);
  codevalGtagEvent(codevalAutoTrackConfig.mirrorEventName, {
    button_name: label,
    function_name: node,
    callgraph_node: node,
    file_path: window.location.pathname,
    ...basePayload
  });
}

function codevalCleanText(value, maxLength = codevalAutoTrackConfig.maxTextLength) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function codevalStackTopFrame(stack, source = '', lineno = '', colno = '') {
  const lines = String(stack || '')
    .split(/\r?\n/)
    .map(line => codevalCleanText(line, 220))
    .filter(Boolean);
  const top = lines.find(line => !/^(error|exception)\b/i.test(line)) || lines[0] || '';
  if (top) return top;
  return codevalCleanText([source, lineno, colno].filter(value => value !== undefined && value !== null && value !== '').join(':'), 220);
}

function codevalStackHash(stack) {
  const text = String(stack || '').slice(0, 4000);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `stk_${(hash >>> 0).toString(16)}`;
}

function codevalLastTrigger() {
  const click = window.__codevalLastClick || {};
  return Date.now() - (click.ts || 0) < 5000 ? click.element_name || '' : '';
}

function codevalLooksLikeUiError(text) {
  return /\b(error|failed|failure|unavailable|expired|invalid|denied|reconnect|unauthorized|unauthorised|forbidden|timeout|exception|unable|not signed in|not authorized|not authorised|cannot|can't|blocked|rejected|missing|required|crash|fatal)\b/i.test(text || '');
}

function codevalElementName(element) {
  if (!(element instanceof Element)) return '';
  const directName =
    element.getAttribute('data-codeval-name') ||
    element.getAttribute('data-analytics-name') ||
    element.getAttribute('data-testid') ||
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.id ||
    element.name ||
    element.value ||
    element.textContent;
  const cleanName = codevalCleanText(directName, 160);
  if (cleanName) return cleanName;
  const className = typeof element.className === 'string' ? element.className : '';
  return codevalCleanText(`${element.tagName.toLowerCase()}${className ? `.${className.replace(/\s+/g, '.')}` : ''}`, 160);
}

function codevalSourceName(element) {
  if (!(element instanceof Element)) return codevalCleanText(element, 160);
  return codevalCleanText(
    element.getAttribute('data-codeval-name') ||
    element.getAttribute('data-analytics-name') ||
    element.getAttribute('data-testid') ||
    element.getAttribute('aria-label') ||
    element.id ||
    element.name ||
    element.getAttribute('role') ||
    element.getAttribute('class') ||
    element.tagName,
    160
  );
}

const codevalRecentUiMessages = new Map();
function codevalTrackUiMessage(message, sourceElement, severity = 'error') {
  const errorMessage = codevalCleanText(message);
  if (!errorMessage || !codevalLooksLikeUiError(errorMessage)) return;
  const source = codevalCleanText(sourceElement, 120);
  const dedupeKey = `${source}:${errorMessage}`;
  const now = Date.now();
  if (now - (codevalRecentUiMessages.get(dedupeKey) || 0) < 3000) return;
  codevalRecentUiMessages.set(dedupeKey, now);
  codevalTrackErrorEvent('cv_ui_error', 'UI error', {
    error_message: errorMessage,
    ui_message: errorMessage,
    source_element: source,
    severity,
    trigger_element: codevalLastTrigger()
  });
}

// ---------- 1. CLICK TRACKING ----------
document.addEventListener('click', (e) => {
  try {
    const source = e.target instanceof Element ? e.target : e.target?.parentElement;
    const el = source?.closest?.('button, a, [role="button"], input, select, textarea, label, summary, [onclick], [data-codeval-name], [data-analytics-name], [data-testid]') || source;
    const name = codevalElementName(el) || 'unknown_click';

    window.__codevalLastClick = {
      element_name: name,
      ts: Date.now()
    };

    codevalGtagEvent('cv_click', {
      element_name: name,
      tag: codevalAutoTrackConfig.tag
    });
  } catch (err) {
    // Fail silently - never break the user's site
  }
});

// ---------- 2. FRONTEND ERROR TRACKING ----------
window.onerror = function(message, source, lineno, colno, error) {
  try {
    const errorMessage = codevalCleanText(message);
    const stack = codevalCleanText(error?.stack || '', 480);
    codevalTrackErrorEvent('cv_frontend_error', 'Frontend error', {
      message: errorMessage,
      error_message: errorMessage,
      source,
      lineno,
      colno,
      stack,
      top_frame: codevalStackTopFrame(stack, source, lineno, colno),
      stack_hash: codevalStackHash(stack || `${source}:${lineno}:${colno}:${errorMessage}`),
      severity: 'error',
      trigger_element: codevalLastTrigger()
    });
  } catch (err) {
    // Never break the user's site
  }
};

window.addEventListener('error', (e) => {
  if (e.target !== window && e.target?.tagName) {
    // script/img/link failed to load
  }
}, true); // capture phase required

const origError = console.error;
console.error = (...args) => {
  // send to GA/Mixpanel
  origError.apply(console, args);
};

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason || {};
  const errorMessage = codevalCleanText(reason.message || reason);
  const stack = codevalCleanText(reason.stack || '', 480);
  codevalTrackErrorEvent('cv_frontend_error', 'Frontend error', {
    message: errorMessage,
    error_message: errorMessage,
    source: 'unhandledrejection',
    stack,
    top_frame: codevalStackTopFrame(stack, 'unhandledrejection'),
    stack_hash: codevalStackHash(stack || errorMessage),
    severity: 'error',
    trigger_element: codevalLastTrigger()
  });
});

// ---------- 2B. UI STATUS / ERROR MESSAGE TRACKING ----------
(function() {
  const selector = [
    '[role="alert"]',
    '[role="status"]',
    '[aria-live]',
    '[data-error]',
    '[data-status]',
    '[data-message]',
    '.error',
    '.alert',
    '.danger',
    '.warning',
    '.toast',
    '.notification',
    '.message',
    '.flash',
    '.banner',
    '.status',
    '.setup-status',
    '[class*="error" i]',
    '[class*="status" i]',
    '[class*="alert" i]',
    '[class*="warning" i]',
    '[class*="toast" i]',
    '[class*="notification" i]',
    '[id*="error" i]',
    '[id*="status" i]',
    '[id*="alert" i]',
    '[id*="message" i]',
    '[id*="Status"]',
    '[id="status"]'
  ].join(',');

  function inspectNode(node) {
    if (!(node instanceof Element)) return;
    const targets = node.matches(selector) ? [node] : Array.from(node.querySelectorAll(selector));
    targets.forEach((target) => {
      const text = codevalCleanText(target.textContent || target.value || '');
      const source = codevalSourceName(target);
      codevalTrackUiMessage(text, source, 'ui_status');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => inspectNode(document.body));
  } else {
    inspectNode(document.body);
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'characterData') {
        inspectNode(mutation.target.parentElement);
      } else {
        inspectNode(mutation.target);
        mutation.addedNodes.forEach(inspectNode);
      }
    });
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true
  });
})();

// ---------- 3. BACKEND ERROR TRACKING (fetch wrapper) ----------
(function() {
  const originalFetch = window.fetch;

  window.fetch = function(url, options) {
    const endpoint = typeof url === 'string' ? url : url?.url || String(url);
    const method = options?.method || 'GET';
    if (codevalShouldIgnoreFetch(endpoint)) {
      return originalFetch(url, options);
    }
    const click = window.__codevalLastClick || {};
    const endpointName = codevalEndpointName(endpoint);
    const requestUrl = codevalSafeRequestUrl(endpoint);
    try {
      codevalGtagEvent('cv_fetch', {
        endpoint: endpointName,
        request_url: requestUrl,
        method,
        trigger_element: Date.now() - (click.ts || 0) < 5000 ? click.element_name : '',
        tag: codevalAutoTrackConfig.tag
      });
    } catch (err) {
      // Never break the user's site
    }
    return originalFetch(url, options)
      .then(res => {
        if (!res.ok) {
          const basePayload = {
            endpoint: endpointName,
            endpoint_name: endpointName,
            request_url: requestUrl,
            method,
            status: res.status,
            status_text: res.statusText,
            trigger_element: codevalLastTrigger(),
            page_path: window.location.pathname,
            severity: 'error',
            tag: codevalAutoTrackConfig.tag
          };
          try {
            res.clone().text().then((body) => {
              codevalTrackErrorEvent('cv_backend_error', 'Backend error', {
                ...basePayload,
                error_message: codevalCleanText(body || res.statusText),
                response_body: codevalCleanText(body, 480)
              });
            }).catch(() => {
              codevalTrackErrorEvent('cv_backend_error', 'Backend error', basePayload);
            });
          } catch (err) {
            codevalTrackErrorEvent('cv_backend_error', 'Backend error', basePayload);
          }
        }
        return res;
      })
      .catch(err => {
        codevalTrackErrorEvent('cv_backend_error', 'Backend error', {
          endpoint: endpointName,
          endpoint_name: endpointName,
          request_url: requestUrl,
          method,
          error_message: err.message,
          trigger_element: codevalLastTrigger(),
          severity: 'error'
        });
        throw err;
      });
  };
})();

const codevalAutoTrackApi = {
  version: '2026-05-23',
  trackUiError(message, sourceElement = 'manual_test') {
    codevalTrackUiMessage(message || 'Manual UI error test', sourceElement, 'manual_test');
  },
  trackError(message, sourceElement = 'manual_test') {
    const errorMessage = codevalCleanText(message || 'Manual frontend error test');
    const source = codevalCleanText(sourceElement, 160);
    codevalTrackErrorEvent('cv_frontend_error', 'Frontend error', {
      message: errorMessage,
      error_message: errorMessage,
      source_element: source,
      source: 'manual',
      top_frame: source,
      stack_hash: codevalStackHash(`${source}:${errorMessage}`),
      severity: 'manual_test',
      trigger_element: codevalLastTrigger()
    });
  }
};

window.AutoTrackErrors = codevalAutoTrackApi;
window.CodeValAutoTrack = codevalAutoTrackApi;
