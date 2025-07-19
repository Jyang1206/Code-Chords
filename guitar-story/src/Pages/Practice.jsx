import React, { useEffect, useState } from "react";
import "../css/Practice.css";
import MJPEGStream from "../components/MJPEGStream";
import GuitarObjDetection from "../components/GuitarObjDetection";
function Practice() {
   
  return (
    <>
      <GuitarObjDetection />
      <MJPEGStream />
    </>
  );
}

export default Practice; 