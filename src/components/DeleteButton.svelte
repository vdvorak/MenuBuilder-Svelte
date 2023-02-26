<script>
  import { createEventDispatcher } from "svelte"
  const dispatch = createEventDispatcher()

  export let targetArray
  export let index
</script>

<button
  on:click={(e) => {
    const arr = [...targetArray]
    arr.splice(index, 1)
    dispatch("delete", arr)
  }}>&#10060;</button
>
