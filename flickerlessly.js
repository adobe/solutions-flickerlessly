/*
Copyright 2021 Adobe
All Rights Reserved.

NOTICE: Adobe permits you to use, modify, and distribute this file in
accordance with the terms of the Adobe license agreement accompanying
it.
*/
/**
 * Flickerlessly
 * @version 1.0.0
 * @author Vadym Ustymenko, Adobe Systems Inc.
 * Lightweight DOM/shadow DOM element readiness detection using CSS animation events.
 *
 * Supports:
 * - Standard selectors:
 *     '.price'
 *     '#container .cta'
 *
 * - Multiple joined selectors:
 *     '.price, .cta, .hero .button'
 *
 * - Optional shadow DOM support:
 *     { shadow: true }
 *   This binds the watcher to the main document and to discovered open shadow roots.
 *
 * - Optional pierced host-chain syntax:
 *     '.outer-host >>> .inner-host >>> .target'
 *   Each >>> means:
 *     "the next selector is inside the shadow root of the previous host element"
 *
 * - Joined selectors can mix standard and pierced syntax:
 *     '.demo-price, .demo-cta, #outer-host >>> #inner-host >>> #nested-slot'
 *
 *   Notes:
 *   - The last selector part is the local selector applied inside each root.
 *   - The full >>> chain is validated only after a local match is found.
 *   - This is a custom Flickerlessly syntax, not native CSS.
 *
 * persist behavior:
 * - persist: false  -> run once, then remove watcher
 * - persist: true   -> keep watcher active; each matching element runs once per watcher
 *
 * Debug logging:
 * - Add ?Debug=1 to the page URL to enable console logs
 *
 * Public API:
 *   Flickerlessly.onReady(
 *     { selector: '.a', success: fn },
 *     { selector: '#host >>> .b', shadow: true, persist: true, success: fn2 }
 *   );
 *
 * Utility:
 *   Flickerlessly._reset();
 *   Removes all watchers, listeners, and injected styles.
 */
window.Flickerlessly = window.Flickerlessly || {};

!function (A) {
    "use strict";

    // Tracks all registered watchers created through Flickerlessly.onReady(...)
    var watchers = [];

    // Small random seed so each watcher gets a unique animation name/id
    var rand = Math.floor((Math.random() * 1000) + 1);

    // Prevents patching attachShadow more than once
    var attachShadowPatched = false;

    // Debug logger enabled only when URL contains Debug=1
    var log = ((window.location.href.indexOf('Debug=1') !== -1) ?
        function () { Array.prototype.unshift.call(arguments, 'FLK:'); console.info.apply(console, arguments); } :
        function () {});

    // Returns the node's root: document for light DOM, ShadowRoot for shadow DOM
    function getNodeRoot(node) {
        return (node && typeof node.getRootNode === 'function') ? node.getRootNode() : document;
    }

    // Builds a watcher-specific success attribute so multiple watchers do not collide
    function getSuccessAttr(id) {
        return 'data-flk-success-' + id;
    }

    // Safe wrapper around element.matches(...)
    // Returns false on invalid selectors instead of throwing
    function matches(node, selector) {
        try {
            return !!(node && node.nodeType === 1 && typeof node.matches === 'function' && node.matches(selector));
        } catch (e) {
            return false;
        }
    }

    // Splits selector list by commas that are NOT inside (), [] or quotes.
    // This allows joined selectors where one group may contain >>>.
    function splitSelectorGroups(selector) {
        var str = String(selector || '');
        var groups = [];
        var current = '';
        var depthParen = 0;
        var depthBracket = 0;
        var quote = null;

        for (var i = 0; i < str.length; i++) {
            var ch = str.charAt(i);
            var prev = i > 0 ? str.charAt(i - 1) : '';

            if (quote) {
                current += ch;
                if (ch === quote && prev !== '\\') {
                    quote = null;
                }
                continue;
            }

            if (ch === '"' || ch === "'") {
                quote = ch;
                current += ch;
                continue;
            }

            if (ch === '(') depthParen++;
            else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
            else if (ch === '[') depthBracket++;
            else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);

            if (ch === ',' && depthParen === 0 && depthBracket === 0) {
                if (current.trim()) groups.push(current.trim());
                current = '';
                continue;
            }

            current += ch;
        }

        if (current.trim()) groups.push(current.trim());

        return groups;
    }

    // Supports custom pierced syntax like:
    //   '.outer-host >>> .inner-host >>> .target'
    //
    // Also supports joined selectors like:
    //   '.demo-price, .demo-cta, #outer >>> #inner >>> #nested-slot'
    //
    // Returns:
    // {
    //   raw: original selector,
    //   groups: [
    //     { raw, parts, local },
    //     ...
    //   ],
    //   locals: ['.demo-price', '.demo-cta', '#nested-slot']
    // }
    function parseSelectorPath(selector) {
        var groups = splitSelectorGroups(selector).map(function (group) {
            var parts = String(group || '')
                .split(/\s*>>>\s*/)
                .map(function (s) { return s.trim(); })
                .filter(Boolean);

            return {
                raw: group,
                parts: parts.length ? parts : [group],
                local: parts.length ? parts[parts.length - 1] : group
            };
        });

        return {
            raw: selector,
            groups: groups,
            locals: groups.map(function (g) { return g.local; })
        };
    }

    // Validates that a matched local element also satisfies one specific full >>> host chain.
    function pathMatchesGroup(el, group) {
        var parts = group.parts;
        var node = el;

        // Normal selector with no >>>, just match the element directly
        if (!parts || parts.length === 1) {
            return matches(el, group.raw);
        }

        // Walk backwards from the matched element through shadow hosts
        for (var i = parts.length - 1; i > 0; i--) {
            if (!matches(node, parts[i])) return false;

            var root = getNodeRoot(node);
            if (!root || !root.host) return false;

            node = root.host;
        }

        // Final check: top-most host must match the first selector part
        return matches(node, parts[0]);
    }

    // Returns the first selector group that matches this element, or null.
    function pathMatches(el, watcher) {
        var groups = watcher.path.groups || [];

        for (var i = 0; i < groups.length; i++) {
            if (pathMatchesGroup(el, groups[i])) {
                return groups[i];
            }
        }

        return null;
    }

    // Resolves the actual matched element for the current root.
    //
    // This matters because animation events can surface from nested structures,
    // and we only want an element that:
    // 1) matches one of the local selectors, and
    // 2) belongs to the current root being watched
    function resolveMatchedElement(event, localSelectors, root) {
        var path = (typeof event.composedPath === 'function') ? event.composedPath() : [event.target];

        for (var i = 0; i < path.length; i++) {
            var node = path[i];

            if (!node || getNodeRoot(node) !== root) continue;

            for (var j = 0; j < localSelectors.length; j++) {
                if (matches(node, localSelectors[j])) {
                    return node;
                }
            }
        }

        return null;
    }

    // Removes listeners/styles for a watcher from every bound root
    function removeWatcher(watcher) {
        if (!watcher || watcher.removed) return;
        watcher.removed = true;

        watcher.bindings.forEach(function (binding) {
            ['animationstart', 'MSAnimationStart', 'webkitAnimationStart'].forEach(function (type) {
                binding.root.removeEventListener(type, binding.listener, false);
            });
            if (binding.style && binding.style.parentNode) {
                binding.style.parentNode.removeChild(binding.style);
            }
        });

        watcher.bindings = [];
    }

    // Builds the CSS animation rule used as the detection mechanism.
    // When an element matching the selector appears in a watched root,
    // the tiny animation triggers and the listener can react.
    function buildCss(animationName, selector) {
        var css = [];
        var prefixes = ['', '-moz-', '-webkit-', '-ms-', '-o-'];

        prefixes.forEach(function (prefix) {
            css.push('@' + prefix + 'keyframes ' + animationName + ' {from {opacity:0.99} to {opacity:1}}');
        });

        css.push(selector + '{');
        prefixes.forEach(function (prefix) {
            css.push(prefix + 'animation-duration:0.001s;' + prefix + 'animation-name:' + animationName + ';');
        });
        css.push('}');

        return css.join('\n');
    }

    // Binds one watcher to one root (document or ShadowRoot):
    // - injects the CSS animation rule into that root
    // - adds animationstart listeners
    // - ensures the same root is not bound twice for the same watcher
    function bindWatcherToRoot(watcher, root) {
        if (!root || watcher.removed) return;

        // Avoid duplicate binding to the same root
        for (var i = 0; i < watcher.bindings.length; i++) {
            if (watcher.bindings[i].root === root) return;
        }

        // Only inject local selectors into the current root;
        // full >>> chain validation happens later in pathMatches()
        var css = buildCss(watcher.animationName, watcher.path.locals.join(', '));
        var style = document.createElement('style');
        style.setAttribute('type', 'text/css');

        if (style.styleSheet) {
            style.styleSheet.cssText = css;
        } else {
            style.appendChild(document.createTextNode(css));
        }

        // For document, inject into <head>; for ShadowRoot, append inside the root
        if (root === document) {
            var head = document.getElementsByTagName('head')[0];
            if (!head) return;
            head.insertBefore(style, head.firstChild);
        } else {
            root.appendChild(style);
        }

        var listener = function (event) {
            // Ignore unrelated animations or removed watchers
            if (event.animationName !== watcher.animationName || watcher.removed) return;

            // Find the locally matched element within this specific root
            var el = resolveMatchedElement(event, watcher.path.locals, root);
            if (!el) return;

            // For joined selectors and >>> selectors, ensure the matched element
            // satisfies at least one full selector group
            var matchedGroup = pathMatches(el, watcher);
            if (!matchedGroup) return;

            // Watcher-specific success flag prevents conflicts between different watchers
            var successAttr = getSuccessAttr(watcher.id);
            var isExecute = (watcher.persist === true || (watcher.persist === false && el.getAttribute(successAttr) === null));

            log("('" + watcher.selector + "') ready! Execute: " + isExecute + ". Matched group: " + matchedGroup.raw, el);

            if (typeof watcher.success === 'function' && isExecute) {
                el.setAttribute(successAttr, '1');

                // Non-persistent watcher runs once, then fully unbinds itself
                if (watcher.persist !== true) {
                    removeWatcher(watcher);
                }

                watcher.success(el, log);
            }
        };

        ['animationstart', 'MSAnimationStart', 'webkitAnimationStart'].forEach(function (type) {
            root.addEventListener(type, listener, false);
        });

        watcher.bindings.push({ root: root, style: style, listener: listener });
    }

    // Recursively discovers open shadow roots below a starting node
    // and invokes cb(root) for each one found.
    function discoverShadowRoots(startNode, cb) {
        if (!startNode || typeof startNode.querySelectorAll !== 'function') return;

        var all = startNode.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            if (all[i].shadowRoot) {
                cb(all[i].shadowRoot);
                discoverShadowRoots(all[i].shadowRoot, cb);
            }
        }
    }

    // Patches Element.prototype.attachShadow so any future shadow roots
    // created after Flickerlessly starts can also be bound automatically.
    function patchAttachShadow() {
        if (attachShadowPatched || !Element.prototype.attachShadow) return;
        attachShadowPatched = true;

        var nativeAttachShadow = Element.prototype.attachShadow;

        Element.prototype.attachShadow = function () {
            var root = nativeAttachShadow.apply(this, arguments);

            // Bind newly created shadow root to every active shadow-enabled watcher
            watchers.forEach(function (watcher) {
                if (!watcher.removed && watcher.shadow === true) {
                    bindWatcherToRoot(watcher, root);
                }
            });

            return root;
        };
    }

    // Creates and registers a watcher
    function init(id, sel, callback, persist, shadow) {
        var watcher = {
            id: id,
            selector: sel,
            path: parseSelectorPath(sel),
            success: callback,
            persist: persist,
            shadow: shadow,
            removed: false,
            animationName: 'atNodeInserted' + id,
            bindings: []
        };

        watchers.push(watcher);

        // Always bind to the main document
        bindWatcherToRoot(watcher, document);

        // If shadow support requested:
        // - patch future attachShadow calls
        // - bind to currently existing open shadow roots
        if (shadow === true) {
            patchAttachShadow();
            discoverShadowRoots(document, function (root) {
                bindWatcherToRoot(watcher, root);
            });
        }

        return watcher;
    }

    // Public API:
    // Flickerlessly.onReady(
    //   { selector: '.a', success: fn, persist: true, shadow: true },
    //   { selector: '#x >>> .y', success: fn2 }
    // )
    A.onReady = function () {
        for (var i = 0; i < arguments.length; i++) {
            var obj = arguments[i] || {};
            init(
                rand++,
                obj.selector,
                obj.success || null,
                obj.persist === true,
                obj.shadow === true
            );
        }
    };

    // Test/helper API to remove all registered watchers and their bindings
    A._reset = function () {
        watchers.slice().forEach(removeWatcher);
        watchers = [];
    };

}(window.Flickerlessly);