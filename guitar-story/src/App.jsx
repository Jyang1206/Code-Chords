import React from 'react'
import { useState, useEffect, use } from 'react'
import Home from './Pages/Home'
import './App.css'
import axios from 'axios'
import { BrowserRouter, Route, Switch } from 'react-router-dom'


function App() {
  return (
    <BrowserRouter>
      <Switch>
        <Route path="/" component = {Home} exact/>
        
      </Switch>
    </BrowserRouter>
      
  )

}

export default App
