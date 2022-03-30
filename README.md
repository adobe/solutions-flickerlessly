# Flickerlessly.js

Flickerlessly is a tiny JavaScript library that helps detecting any specified HTML element as soon as it appears on the page. It is one of the most performant ways for DOM element detection thanks to the `keyframes` animation technique. This approach successfully replaces the DOM polling with `setTimeout`/`setInterval` that drains device resources or `MutationObserver` that has browser limitations and may be a less performant solution. 

## How Flickerlessly Works

Behind the scenes, Flickerlessly is subscribing to DOM `animationstart` events. During initialization all specified CSS selectors are assigned to `keyframes` animation rules. Once specified elements appear in the DOM, animation is triggered and JavaScript event listener receives a notification to trigger a specified callback function for particular selectors. 

## Example of Usage

```
Flickerlessly.onReady({
    selector: '.a, .b', 
    success: function(el, log){
        log("Detected element", el);
    }},
    {selector: '.c', 
    success: myCallbackFn, 
    persist: true 
});
```

## Documentation

`Flickerlessly.onReady([object1, object2, objectN])` is the only available initializer method.

The object in the Array list of arguments has the following structure:
 
| Name                    | Type     | Required | Default | Description                                |
|-------------------------|----------|----------|---------|--------------------------------------------|
| selector                | String   | Yes      | None    | CSS selector(s) to be detected             |
| success                 | Function | Yes      | None    | Callback to execute after element detected | 
| persist                 | Bool     | No       | false   | Executes the callback again if true        | 

`selector` can be any CSS selector or list of selectors: `.myClass` or `body > p, #myElement`, etc.

`success` is a custom callback function. It passes detected element and custom logger in the arguments:
```
success: function(el, log){
    log("Detected element", el);
}}
```

`persist` is a Boolean that indicates whether the above callback function needs to be executed again, when set to true, or suppressed for every following new `keyframe` animation. Why would animation occur more than once? Since we are using `keyframe` animations for specified elements, animations are triggered every time this element is is touched by DOM tree (for example, child is appended inside). 

## Why Flickerlessly?

Creation of Flickerlessly was inspired to find a better DOM polling solution to be used in Adobe Target HTML offers where detection of elements is required to perform any DOM manipulations. But Flickerlessly can be used for any scenarios where DOM detection is needed.

### Contributing

Contributions are welcomed! Read the [Contributing Guide](CONTRIBUTING.md) for more information.

### Licensing

This project is licensed under the MIT License. See [LICENSE](LICENSE) for more information.