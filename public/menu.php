<?php

$json = file_get_contents("php://input");
$data = json_decode($json);
$requestId = $data->requestId;
$url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://$_SERVER[HTTP_HOST]$_SERVER[REQUEST_URI]";


if($requestId == "create") {

  $pages = $data->pages;

  require_once(getcwd()."/lib/tfpdf/tfpdf.php");

  define("LOGO_POSITION", 130);

  class Menu extends tFPDF {
    public $shiftedHeader = false;
    public $pageTitle = "";

    function header() {
       if(!$this->shiftedHeader) {
          $this->renderHeader();
       }
    }

    function Footer() {
        // Page number
        $this->SetY(-15);
        $this->SetFont('Arial','I',8);
        $this->Cell(0,10,$this->PageNo(),0,0,'C');
    }

    function _SetFont($fs=12, $red=false) {
      $this->SetFont('arial_uni','', $fs);
      $this->SetTextColor($red ? 255 : 0,0,0);
    }

    function renderHeader() {
     
      $this->_SetFont(16);
      $this->SetX(15);

      if($this->shiftedHeader) {
        $this->Ln(25);
        $this->Cell(5);
        $this->Cell(50,10, $this->pageTitle);
        $this->Image(getcwd().'/logo.png', LOGO_POSITION - 6, 18, -130);
      } else {
        $this->Image(getcwd().'/logo.png', LOGO_POSITION - 6, 10, -130);
        $this->Cell(0,10, $this->pageTitle);
        $this->Ln(8);
      }
    
    }
  }

  $pdf = new Menu();
  $pdf->AddFont('arial_uni','',"arial_unicode.ttf",true);
  $pdf->SetFont('arial_uni','',10);

  for ($pageIndex=0; $pageIndex < count($pages); ++$pageIndex) {
    $page = $pages[$pageIndex];
    $pdf->pageTitle =  $page->title;
    $sections = $page->sections;
    $pdf->shiftedHeader = count($sections) < 3;

    $pdf->AddPage();
    if($pdf->shiftedHeader) {
      $pdf->renderHeader();
    }
    // Page title
    $pdf->SetX(15);
    $pdf->_SetFont(12);

    
    for ($sectionIndex=0; $sectionIndex < count($sections); ++$sectionIndex) {
      $section = $sections[$sectionIndex];
      $pdf->ln(count($sections) > 2 ? 5 : 15);
      // Section title
      $pdf->SetX(15);
      $pdf->_SetFont(12, true);
      $pdf->Cell(0,10,$section->title,0,1);
      
      $items=$section->items;
      for($i = 0; $i < count($items); ++$i) {

            $item = $items[$i];

            $spacing=6;
            // Before
            if(isset($section->beforeAsServing) && $section->beforeAsServing) {
              $pdf->SetX(10);
              $pdf->_SetFont(6);
            } else {
              $pdf->_SetFont(9);
            }      
            $pdf->Cell(10,$spacing,$item->before,0,0, 'L');

            // Label
            $pdf->SetX(16);
            $pdf->_SetFont(11);
            $pdf->Cell(0,$spacing,$item->title,0,0, 'L');

            // Alergens
            $pdf->SetX(LOGO_POSITION + 45);
            $pdf->_SetFont(9);
            $pdf->SetFillColor(230, 230, 230);
            $pdf->Cell(9,$spacing,$item->alergens,0,0, 'C', TRUE);
           
            // Price
            $pdf->_SetFont(10);
            $pdf->SetFillColor(255,255,255);
            $pdf->SetX(LOGO_POSITION + 56);
            $pdf->Cell(5,$spacing,$item->price,0,0, 'C', TRUE);

            // Unit
            $pdf->SetX(LOGO_POSITION + 62);
            $pdf->Cell(5,$spacing,$item->unit,0,1);
      }
      $pdf->ln($sectionIndex != count($sections) && count($sections) > 2 ? 5 : 15);
    }

    if($pageIndex == count($pages)-1){
      $pdf->_SetFont(8);
      $pdf->Cell(100,7,"Alergeny: 1.Lepek, 2.Korýši, 3.Vejce, 4.Ryby, 5.Arašídy, 6.Sója, 7.Mléko, 8.Skořábkové plody, 9.Celer, 10. Hořčice, 11.Sezam, 12.Oxid siřičitý",0,1);
      $pdf->Cell(100,0,"a siřičitany, 13.Vlčí bob, 14.Měkkýši",0);

    }
  }

  $attachment_location = $_SERVER['DOCUMENT_ROOT']."/menu.pdf";
  $pdf->Output($attachment_location, 'F');


  if (!file_exists($attachment_location)) {
    die("Error: File not found.");
  }
}