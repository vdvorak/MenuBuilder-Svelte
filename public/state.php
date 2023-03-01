
<?php

$data = json_decode(file_get_contents("php://input"));


if($data->requestId == "upload") {
  $pages = $data->pages;
  if(!isset($pages) || empty($pages)) {
    die;
  }
  $res = file_put_contents("menu.json", json_encode($pages));
  if($res) {
    echo json_encode("success");
  }
}

if($data->requestId == "download") {
  if (!file_exists("menu.json")) {
   echo json_encode([]);
  }
  else {
    echo file_get_contents("menu.json");
  }
}