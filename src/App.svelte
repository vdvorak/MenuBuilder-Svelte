<script>
  import Page from "./components/Page.svelte"
  import Store from "./Store.js"
  import { importData, getTextFileLink, loadData } from "./Menu.js"

  const store = new Store(loadData)

  let loaded
  let pages
  $: {
    loaded = store.loaded
    if ($loaded) {
      pages = store.getValue(["pages"])
    }
  }

  function add(e) {
    store.setValue(
      ["pages"],
      [
        this._store.getValueCopy(["pages"]),
        { title: "Nová stránka", sections: [] },
      ]
    )
  }
</script>

{#if $loaded}
  <div class="header">
    <div class="container">
      <input
        type="file"
        on:change={(e) =>
          importData(e, store.setValue(["pages"], JSON.parse(e.target.result)))}
      />
      <button on:click={add}>Přidat stránku</button>
      <a download="menu.txt" href={getTextFileLink($pages)}>Txt</a>
    </div>
  </div>
  {#each $pages as page, i}
    <Page {store} path={["pages", i]} />
  {/each}
{/if}
