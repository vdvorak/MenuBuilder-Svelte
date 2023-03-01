<script>
  export let store
  export let path

  const xpath = [...path]
  const index = xpath.pop()

  let array
  $: {
    array = store.getRef(xpath)
  }
</script>

<button
  class="delete"
  on:click={(e) =>
    store.setValue(xpath, [...$array.filter((e, i) => i != index)])}>❌</button
>
