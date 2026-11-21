'use client';
import CatalogPage from '../../components/CatalogPage';

const GENRES = ['Ação', 'Aventura', 'Animação', 'Comédia', 'Crime', 'Documentário', 'Drama', 'Fantasia', 'Ficção Científica', 'Horror', 'Mistério', 'Romance', 'Terror', 'Thriller'];

export default function FilmesPage() {
  return <CatalogPage kind="movies" title="Filmes" base="/filmes" genres={GENRES} />;
}
