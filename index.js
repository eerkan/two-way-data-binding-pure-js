class DOMObserver {
    #subscribers = [];

    constructor(target, observeEvents) {
        observeEvents.forEach(observeEvent => {
            target.addEventListener(observeEvent, event => this.#onNext(event));
        });
    }

    #onNext(event) {
        this.#subscribers.forEach(subscriber => subscriber.callback(event));
    }

    subscribe(callback) {
        const id = this.#subscribers.length;
        this.#subscribers.push({
            id,
            callback
        });
        return id;
    }

    unsubscribe(subscribitionId) {
        this.#subscribers = this.#subscribers.filter(subscriber => subscriber.id != subscribitionId);
    }
}

class App {
    #scopeAbstract = {};
    #scopeTrigger = true;
    #scope;
    #twoWayBindings = {};
    #watchesAll = [];

    constructor() {
        this.#setupTwoWayBind();
        this.#setupProxyForTwoWayBind();
    }

    #setupProxyForTwoWayBind() {
        this.#scope = new Proxy(this.#scopeAbstract, {
            get: function (target, prop) {
                return target[prop];
            },
            set: (function (target, prop, value) {
                target[prop] = value;
                this.#effectChanges(prop, null);
                return true;
            }).bind(this)
        });
    }

    #setupTwoWayBind() {
        const twoWayBindeds = this.#getTwoWayBindeds();
        this.#observeTwoWayBindeds(twoWayBindeds);
    }

    #observeTwoWayBindeds(twoWayBindeds) {
        Object.keys(twoWayBindeds).forEach(variable => {
            const elements = twoWayBindeds[variable];
            elements.forEach(element => this.#observeTwoWayBinded(variable, element));
        });
    }

    #observeTwoWayBinded(variable, element) {
        if (this.#twoWayBindings[variable] == null)
            this.#twoWayBindings[variable] = {
                observers: [],
                elements: [],
                watches: []
            };
        if (element instanceof HTMLInputElement) {
            const domObserver = new DOMObserver(element, ['input']);
            domObserver.subscribe(event => {
                this.#scopeTrigger = false;
                const oldValue = this.#scope[variable];
                this.#scope[variable] = event.target.value;
                this.#scopeTrigger = true;
                this.#effectChanges(variable, element, oldValue);
            });
            this.#twoWayBindings[variable].observers.push(domObserver);
        }
        this.#twoWayBindings[variable].elements.push(element);
    }

    #effectChanges(variable, effectedElement, oldValue) {
        const value = this.#scope[variable];
        this.#twoWayBindings[variable].elements.forEach(element => {
            if (element == effectedElement) return;
            if (element instanceof HTMLInputElement) {
                element.value = value;
            } else {
                element.innerHTML = value;
            }
        });
        if (effectedElement != null) {
            this.#twoWayBindings[variable].watches.forEach(watchCallback => watchCallback(variable, value, oldValue));
            this.#watchesAll.forEach(watchCallback => watchCallback(variable, value, oldValue));
        }
    }

    #getTwoWayBindeds() {
        return Array.from(document.querySelectorAll('*[data-two-way-bind]'))
            .map(twoWayBindedDOM => {
                return {
                    variable: twoWayBindedDOM.getAttribute('data-two-way-bind'),
                    element: twoWayBindedDOM
                };
            })
            .reduce((previosValue, currentValue) => {
                const variable = currentValue.variable;
                const element = currentValue.element;
                if (Array.isArray(previosValue[variable]))
                    previosValue[variable].push(element);
                else
                    previosValue[variable] = [element];
                return previosValue;
            }, {});
    }

    watch(variables, callback) {
        if (Array.isArray(variables))
            variables.forEach(variable => this.#twoWayBindings[variable].watches.push(callback));
        else {
            this.watch([variables]);
        }
    }

    watchAll(callback) {
        this.#watchesAll.push(callback);
    }

    set(variable, value) {
        this.#scope[variable] = value;
        this.#effectChanges(variable, null);
    }

    get(variable) {
        return this.#scope[variable];
    }

    controller(callback) {
        callback(this.#scope);
        return this;
    }

    bind(variable, callback) {
        this.watchAll(() => {
            this.#scope[variable] = callback(this.#scope);
        });
        return this;
    }
}

const parseVariables = $scope => {
    const a = parseFloat($scope.a);
    const b = parseFloat($scope.b);
    return {
        a: !isNaN(a) ? a : null,
        b: !isNaN(b) ? b : null
    };
};

const app = new App()
    .bind('resultAdd', $scope => {
        const variables = parseVariables($scope);
        return (variables.a ?? 0) + (variables.b ?? 0);
    })
    .bind('resultSub', $scope => {
        const variables = parseVariables($scope);
        return (variables.a ?? 0) - (variables.b ?? 0);
    })
    .bind('resultMul', $scope => {
        const variables = parseVariables($scope);
        return (variables.a ?? 0) * (variables.b ?? 0);
    })
    .bind('resultDiv', $scope => {
        const variables = parseVariables($scope);
        if (variables.b == 0 || variables.b == null) return "Sıfıra bölme hatası";
        return (variables.a ?? 0) / (variables.b ?? 1);
    });