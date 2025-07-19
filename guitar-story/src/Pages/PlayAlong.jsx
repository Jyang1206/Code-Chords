import React, { useState, useRef } from "react";
import PlayAlongOverlay from "../components/PlayAlongOverlay";
import { Routes, Route } from "react-router-dom";
import Home from "./Home";
import Practice from "./Practice";

function parseTabFromHtml(html) {
  const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/gi);
  if (!preMatch) return [];
  const tabText = preMatch[0].replace(/<[^>]+>/g, "");
  return tabText.split("\n").filter(line => line.trim().length > 0);
}

const DEFAULT_SONG = "Enter Sandman";

function PlayAlong() {
  const [song, setSong] = useState(DEFAULT_SONG);
  const [tabLines, setTabLines] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIdx, setCurrentLineIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const playTimer = useRef(null);

  // Fetch tab from Songsterr
  const fetchTab = async (song) => {
    setLoading(true);
    setTabLines([]);
    setCurrentLineIdx(0);
    try {
      const res = await fetch(`https://www.songsterr.com/a/wa/bestMatchForQueryStringPart?s=${encodeURIComponent(song)}`);
      const data = await res.json();
      if (data.length > 0) {
        const id = data[0].id;
        const tabRes = await fetch(`https://www.songsterr.com/a/wa/view?r=${id}`);
        const tabHtml = await tabRes.text();
        const lines = parseTabFromHtml(tabHtml);
        setTabLines(lines);
      } else {
        setTabLines(["No tab found for this song."]);
      }
    } catch (e) {
      setTabLines(["Error loading tab."]);
    }
    setLoading(false);
  };

  const startPlayback = () => {
    setIsPlaying(true);
    setCurrentLineIdx(0);
    playTimer.current = setInterval(() => {
      setCurrentLineIdx(idx => {
        if (tabLines && idx < tabLines.length - 1) {
          return idx + 1;
        } else {
          clearInterval(playTimer.current);
          setIsPlaying(false);
          return idx;
        }
      });
    }, 500); // 0.5s per line for MVP
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    clearInterval(playTimer.current);
  };

  return (
    <div style={{ textAlign: "center", color: "#fff", background: "#181c24", minHeight: "100vh", paddingTop: 40 }}>
      <h2>Play Along</h2>
      <div style={{ margin: "2em" }}>
        <input
          type="text"
          value={song}
          onChange={e => setSong(e.target.value)}
          placeholder="Enter song name"
          style={{ fontSize: "1.1em", padding: "0.3em 1em", width: 260 }}
          disabled={isPlaying || loading}
        />
        <button
          style={{ fontSize: "1.2em", padding: "0.5em 2em", margin: "1em" }}
          onClick={() => fetchTab(song)}
          disabled={isPlaying || loading}
        >
          {loading ? "Loading..." : "Load Tab"}
        </button>
        <button
          style={{ fontSize: "1.2em", padding: "0.5em 2em", margin: "1em" }}
          onClick={startPlayback}
          disabled={!tabLines.length || isPlaying}
        >
          Play
        </button>
        <button
          style={{ fontSize: "1.2em", padding: "0.5em 2em", margin: "1em" }}
          onClick={stopPlayback}
          disabled={!isPlaying}
        >
          Stop
        </button>
      </div>
      <div style={{ position: "relative", width: 640, height: 480, margin: "0 auto" }}>
        <PlayAlongOverlay tabLine={isPlaying && tabLines.length > 0 ? tabLines[currentLineIdx] : null} />
      </div>
    </div>
  );
}

export default PlayAlong; 