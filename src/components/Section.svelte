<script>
  import Item from "./Item.svelte"
  import * as Defaults from "../Defaults.js"
  import FormInput from "./FormInput.svelte"

  export let store
  export let path

  function add(lastIndex) {
    store.setValue(
      [...path, "items"],
      [
        ...store.getValueCopy([...path, "items"]),
        {
          before: Defaults.BEFORE[lastIndex],
          title: "",
          alergens: "",
          price: Defaults.PRICE[lastIndex],
          unit: Defaults.UNIT,
        },
      ]
    )
  }

  let items
  $: {
    items = store.getValue([...path, "items"])
    console.log($items)
  }
</script>

<div class="section">
  <FormInput className="section-title" {store} path={[...path, "title"]} />
  <button on:click={(e) => add($items.length)}>Přidat položku</button>
  {#each $items as item, i}
    <Item {store} path={[...path, "items", i]} />
  {/each}
</div>
