import { Link } from "react-router-dom";
import "../css/Navbar.css";
import React, { useContext } from "react";
import { ThemeContext } from "../App";

function NavBar() {
    const { lightMode } = useContext(ThemeContext);
    return (
        <nav className={`navbar${lightMode ? " navbar-light" : " navbar-dark"}`}>
            <div className="navbar-brand">
                <Link to="/">Guitar Story</Link>
            </div>
            <div className="navbar-links">
                <Link to="/" className="nav-link">Home</Link>
                <Link to="/Practice" className="nav-link">Practice</Link>
                <Link to="/Learn songs" className="nav-link">Learn songs</Link>
                <Link to="/Settings" className="nav-link">Settings</Link>
            </div>
        </nav>
    );
}

export default NavBar;