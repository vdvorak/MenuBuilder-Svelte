<script>
  import Page from "./components/Page.svelte"
  import Store from "./Store.js"
  import {
    importData,
    getTextFileLink,
    loadData,
    getJsonLink,
    createPDF,
  } from "./Menu.js"
  import UploadButton from "./components/UploadButton.svelte"

  const store = new Store(loadData)

  let loaded
  let pages
  $: {
    loaded = store.loaded
    if ($loaded) {
      pages = store.getRef(["pages"])
    }
  }

  function add(e) {
    store.setValue(
      ["pages"],
      [...$pages, { title: "Nová stránka", sections: [] }]
    )
  }
</script>

{#if $loaded}
  <div class="header">
    <div class="container">
      <div class="exports">
        <div class="row">
          <UploadButton
            label="Import"
            on:upload={(e) => {
              importData(e.detail.target.files[0], (data) =>
                store.setValue(["pages"], JSON.parse(data.target.result))
              )
            }}
          />
          <a class="data-color" download="menu.json" href={getJsonLink($pages)}
            >Export</a
          >
        </div>

        <div class="row">
          <a
            class="data-color"
            download="menu.txt"
            href={getTextFileLink($pages)}>.txt</a
          >
          <button class="data-color" on:click={(e) => createPDF($pages)}
            >.pdf</button
          >
        </div>
      </div>
      <div class="row"><button on:click={add}>Přidat stránku</button></div>
    </div>
  </div>
  {#each $pages as page, i}
    <Page {store} path={["pages", i]} />
  {/each}
{/if}
