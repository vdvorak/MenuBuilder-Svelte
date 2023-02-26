<script>
  export let store
  export let path
  export let className = ""
  export let placeholder = ""
  export let type = "text"

  $: value = store.getValue(path)
</script>

<input
  {placeholder}
  {type}
  class={className}
  value={$value}
  on:input={(e) => store.setValue(path, e.target.value)}
/>
