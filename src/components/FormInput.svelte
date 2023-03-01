<script>
  export let store
  export let path
  export let className = ""
  export let placeholder = ""
  export let type = "text"

  $: value = store.getRef(path)
</script>

<input
  name={path.join("-")}
  id={path.join("-")}
  {placeholder}
  {type}
  class={className}
  value={$value}
  on:input={(e) => store.setValue(path, e.target.value)}
/>
