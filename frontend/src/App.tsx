import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './components/Layout/Navbar';
import { LoginPage } from './pages/Login';
import { MapPage } from './pages/MapPage';
import { ProfilePage } from './pages/Profile';
import { PublicProfilePage } from './pages/PublicProfile';
import { FriendsPage } from './pages/Friends';
import { LeaderboardPage } from './pages/Leaderboard';
import { TeamRankingPage } from './pages/TeamRanking';
import { AuthSuccessPage } from './pages/AuthSuccess';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/success" element={<AuthSuccessPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:userId" element={<PublicProfilePage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/leaderboard/:team" element={<TeamRankingPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
