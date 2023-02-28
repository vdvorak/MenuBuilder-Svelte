export function importData(e, callback) {
  const reader = new FileReader()
  reader.onload = callback
  reader.readAsText(e.target.files[0])
}

export function getJsonLink(pages) {
  save()
  const blob = new Blob([JSON.stringify(pages)], {
    type: "application/json;charset=utf-8;",
  })
  return window.URL.createObjectURL(blob)
}

export function getTextFileLink(pages) {
  save()
  let data = ""
  pages.forEach((page, i) => {
    data += (i > 0 ? "\n\n\n" : "") + page.title + "\n\n"
    page.sections.forEach((section, j) => {
      data += (j > 0 ? "\n\n" : "") + section.title + "\n\n"
      section.items.forEach((item) => {
        data += `${item.before} ${item.title} ${item.alergens}\n`
      })
    })
  })

  data +=
    "\n\n\nAlergeny: 1.Lepek, 2.Korýši, 3.Vejce, 4.Ryby, 5.Arašídy, 6.Sója, 7.Mléko, 8.Skořábkové plody,\n"
  data +=
    "9.Celer, 10. hořčice, 11.Sezam, 12.Oxid siřičitý a siřičitany, 13.Vlčí bob,14.Měkkýši"

  const file = new Blob([data], { type: "text/plain" })
  return window.URL.createObjectURL(file)
}

export function createPDF(pages) {
  save()
  fetch("menu.php", {
    method: "POST",
    headers: {
      "Content-type": "application/json",
    },
    body: JSON.stringify({
      pages,
      requestId: "create",
    }),
  })
    .then((res) => {
      if (res.status == 200) {
        window.open(
          `${window.location.protocol}//${window.location.host}/menu.pdf`,
          "_blank"
        )
      }
    })
    .catch((error) => console.log(error))
}

export function save(pages) {
  fetch("state.php", {
    method: "POST",
    headers: {
      "Content-type": "application/json",
    },
    body: JSON.stringify({
      requestId: "upload",
      pages,
    }),
  }).catch((error) => console.log(error))
}

export function loadData(callback) {
  fetch("state.php", {
    method: "POST",
    headers: {
      "Content-type": "application/json",
    },
    body: JSON.stringify({
      requestId: "download",
    }),
  })
    .then((res) => res.json())
    .then((pages) => callback({ pages }))
    .catch((error) => console.log(error))
}
