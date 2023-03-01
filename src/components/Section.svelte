<script>
  import Item from "./Item.svelte"
  import * as Defaults from "../Defaults.js"
  import FormInput from "./FormInput.svelte"
  import DeleteButton from "./DeleteButton.svelte"

  export let store
  export let path

  function add(lastIndex) {
    store.setValue(
      [...path, "items"],
      [
        ...store.getValue([...path, "items"]),
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
  $: items = store.getRef([...path, "items"])
</script>

<div class="section">
  <div class="section-row">
    <FormInput className="section-title" {store} path={[...path, "title"]} />
    <button on:click={(e) => add($items.length)}>Přidat položku</button>
    <div class="checkbox">
      <FormInput type="checkbox" {store} path={[...path, "beforeAsServing"]} />
      <label for={[...path, "beforeAsServing"].join("-")}>Porce</label>
    </div>
  </div>
  <DeleteButton {store} {path} />
  {#each $items as item, i}
    <Item {store} path={[...path, "items", i]} />
  {/each}
</div>
