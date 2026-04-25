/*
WeakObjectMap holds a weak reference, so the object linked to can be garbage collected.
The get() method will return undefined if this has happened.
*/
class WeakObjectMap {
    constructor() { this.map = {} }
    set(key, value) { this.map[key] = new WeakRef(value) }
    get(key) { return this.map[key]?.deref() }
}

export const graph_id_to_tab = new WeakObjectMap()