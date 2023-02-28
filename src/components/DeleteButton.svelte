<script>
  export let store
  export let path

  const xpath = [...path]
  const index = xpath.pop()

  let array
  $: {
    array = store.getValue(xpath)
  }
</script>

<button
  on:click={(e) =>
    store.setValue(xpath, [...$array.filter((e, i) => i != index)])}
  >&#10060;</button
>
