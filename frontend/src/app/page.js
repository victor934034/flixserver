import api from '../lib/api';
import Navbar from '../components/Navbar';
import HeroBanner from '../components/HeroBanner';
import ContentRow from '../components/ContentRow';

async function getData() {
  try {
    const [featured, newMovies, newSeries, popularMovies] = await Promise.all([
      api.get('/featured').then(r => r.data).catch(() => []),
      api.get('/movies/section/new').then(r => r.data).catch(() => []),
      api.get('/series/section/new').then(r => r.data).catch(() => []),
      api.get('/movies/section/popular').then(r => r.data).catch(() => []),
    ]);
    return { featured, newMovies, newSeries, popularMovies };
  } catch {
    return { featured: [], newMovies: [], newSeries: [], popularMovies: [] };
  }
}

export default async function Home() {
  const { featured, newMovies, newSeries, popularMovies } = await getData();

  return (
    <>
      <Navbar />
      <main>
        <HeroBanner items={featured} />
        <ContentRow title="Novos Filmes" items={newMovies} type="movie" />
        <ContentRow title="Novas Séries" items={newSeries} type="series" />
        <ContentRow title="Mais Assistidos" items={popularMovies} type="movie" />
      </main>
    </>
  );
}
