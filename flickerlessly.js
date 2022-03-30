/*
Copyright 2021 Adobe
All Rights Reserved.

NOTICE: Adobe permits you to use, modify, and distribute this file in
accordance with the terms of the Adobe license agreement accompanying
it.
*/
/**
 * flickerlessly.js
 * @version 0.2.2
 * @author Vadym Ustymenko, Adobe Systems Inc.
 * @copyright 1996-2020. Adobe Systems Incorporated. All rights reserved.
 * @use Flickerlessly.onReady({selector:'.a, .b', success:function(el, log){}},
 *                              {selector:'.c', success:myCallbackFn, persist:true });
 */
window.Flickerlessly=window.Flickerlessly||{};
!function(A) {
    "use strict";
    var init = function(id, sel, callback, persist){
        var animationName = 'atNodeInserted'+id;
        var css = [], prefixes = ['','-moz-','-webkit-','-ms-','-o-'];
        prefixes.forEach(function(prefix, index){
            css.push('@'+prefix+'keyframes '+animationName+' {from {opacity:0.99} to {opacity:1}}');
        });
        css.push(sel+'{');
        prefixes.forEach(function(prefix, index){
            css.push( prefix+'animation-duration:0.001s;'+prefix+'animation-name:'+animationName+';');
        });
        css.push('}');
        var head = document.getElementsByTagName("head")[0];
        if (head) {
            var style = document.createElement("style");
            style.setAttribute("type", "text/css");
            if (style.styleSheet)
                style.styleSheet.cssText = css.join('\n');
            else
                style.appendChild(document.createTextNode(css.join('\n')));
            head.insertBefore(style, head.firstChild)
        };
        var _removeListener = function(){
            ['animationstart','MSAnimationStart','webkitAnimationStart'].forEach(function(item, index){
                document.removeEventListener(item, _insertListener, false);
            });
            if(style)
                style.parentNode.removeChild(style);
        };
        var _insertListener = function(event){
            if (event.animationName === animationName && typeof event.target === 'object') {
                var isExecute = ( (persist === true) || (persist === false && event.target.getAttribute('data-flk-success') === null) ) ? true : false;
                log("('"+sel+"') ready! Execute: "+isExecute, event.target);
                if(typeof callback==='function' && isExecute){
                    event.target.setAttribute('data-flk-success', animationName);
                    if (persist !== true) // remove listeners
                        _removeListener();
                    callback(event.target, log);
                }else{
                    log("Won't Callback", isExecute, callback);
                }
            }
        };
        ['animationstart','MSAnimationStart','webkitAnimationStart'].forEach(function(item, index){
            document.addEventListener(item, _insertListener, false);
        });
    },
    log = ((window.location.href.indexOf('Debug=1')!==-1) ? 
            function () { Array.prototype.unshift.call(arguments, 'FLK:'); console.info.apply(this, arguments); } :
            function () {}),
    rand = Math.floor((Math.random() * 1000) + 1);//unique per instance
    A.onReady = function(){
        for (var i = 0; i < arguments.length; i++) {
            var obj = arguments[i];
            var selector = obj.selector;
            var success = obj.success||null;
            var persist = obj.persist||false;
            init(rand++, selector, success, persist);
        };
    };
}(Flickerlessly);

// @todo 1. do not re-apply for same elements

/* // History
v 0.2.0 - 20181200 - code improvements
v 0.2.1 - 20181220 - passing log to callback
v 0.2.2 - 20200625 - listeners removal, logging improvement
*/