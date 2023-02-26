<script>
  import Store from "./Store.js"
  import Page from "./components/Page.svelte"

  const store = new Store({ pages: [{ sections: [], title: "hello" }] })
  let pages
  $: pages = store.getValue(["pages"])

  function add() {
    store.setValue(
      ["pages"],
      [store.getValueCopy(["pages"]), { title: "Added page", sections: [] }]
    )
  }
</script>

<button on:click|preventDefault={(e) => add()}>Add page</button>
{#each $pages as page, i}
  <Page {store} path={["pages", i]} />
{/each}
