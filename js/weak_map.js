
class WeakMap {
    constructor() {
        this.map = {}
    }

    set(key, value) {
        this.map[key] = new WeakRef(value)
    }

    get(key) {
        return this.map[key]?.deref()
    }
}

export const unique_to_tab = new WeakMap()