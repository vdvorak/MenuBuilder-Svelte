<script>
  import FormInput from "./FormInput.svelte"

  export let store
  export let path
</script>

<div class="item">
  <FormInput placeholder="Před" {store} path={[...path, "before"]} />
  <FormInput placeholder="Název" {store} path={[...path, "title"]} />
  <FormInput
    type="number"
    placeholder="Cena"
    {store}
    path={[...path, "price"]}
  />
  <FormInput placeholder="Alergeny" {store} path={[...path, "alergens"]} />
  <FormInput placeholder="Jednotka" {store} path={[...path, "unit"]} />

  <slot />
</div>
