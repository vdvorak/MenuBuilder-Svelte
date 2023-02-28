<script>
  import Section from "./Section.svelte"
  import FormInput from "./FormInput.svelte"
  import DeleteButton from "./DeleteButton.svelte"

  export let store
  export let path

  function add() {
    store.setValue(
      [...path, "sections"],
      [
        ...store.getValueCopy([...path, "sections"]),
        { title: "Added section", items: [] },
      ]
    )
  }

  let sections
  $: sections = store.getValue([...path, "sections"])
</script>

<div class="page">
  <div class="row">
    <FormInput className="page-title" {store} path={[...path, "title"]} />
    <DeleteButton {store} {path} />
    <button on:click={(e) => add()}>Přidat sekci</button>
  </div>
  {#each $sections as section, i}
    <Section {store} path={[...path, "sections", i]} />
  {/each}
</div>
