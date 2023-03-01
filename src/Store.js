import { writable, derived, get } from "svelte/store"

class Store {
  constructor(initMethod) {
    this._store = writable({})
    this.loaded = writable(false)

    initMethod((data) => {
      this._store.set(data)
      this.defaultData = JSON.parse(JSON.stringify(data))
      this.loaded.set(true)
    })
  }

  setValue(path, value) {
    const lastKey = path[[path.length - 1]]
    const target = { ...get(this.getData()) }

    path.slice(0, -1).reduce((acc, key) => acc[key], target)[lastKey] = value

    this._store.set(target)
  }

  getRef(path) {
    return derived(this._store, ($data) =>
      path.reduce((obj, key) => obj && obj[key], $data)
    )
  }

  getValue(path) {
    return get(this.getRef(path))
  }

  getDefaultValue(path) {
    return path.reduce((obj, key) => obj && obj[key], this.defaultData)
  }

  isChanged(path) {
    return (
      JSON.stringify(this.getValue(path)) !==
      JSON.stringify(this.getDefaultValue(path))
    )
  }

  get isDirty() {
    return JSON.stringify(this.getData()) !== JSON.stringify(this.defaultData)
  }

  getData() {
    return derived(this._store, ($data) => $data)
  }

  subscribe(run) {
    this._store.subscribe(run)
  }
}

export default Store
