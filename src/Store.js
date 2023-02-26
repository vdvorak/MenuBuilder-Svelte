import { writable, derived, get } from "svelte/store"

class Store {
  constructor(initData) {
    this.store = writable(initData)
    this.defaultData = JSON.parse(JSON.stringify(initData))
  }

  setValue(path, value) {
    const lastKey = path[[path.length - 1]]
    const target = { ...get(this.getData()) }

    path.slice(0, -1).reduce((acc, key) => acc[key], target)[lastKey] = value

    this.store.set(target)
  }

  getValue(path) {
    return derived(this.store, ($data) =>
      path.reduce((obj, key) => obj && obj[key], $data)
    )
  }

  getValueCopy(path) {
    return get(this.getValue(path))
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
    return derived(this.store, ($data) => $data)
  }
}

export default Store
