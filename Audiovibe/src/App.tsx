import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout';
import { 
  Home, 
  Library, 
  Collections, 
  Player, 
  Settings, 
  Downloads,
  SearchResults
} from './pages';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="search" element={<SearchResults />} />
          <Route path="library" element={<Library />} />
          <Route path="collections" element={<Collections />} />
          <Route path="collections/:id" element={<Collections />} />
          <Route path="downloads" element={<Downloads />} />
          <Route path="player" element={<Player />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
