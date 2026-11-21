'use client';
import CatalogPage from '../../components/CatalogPage';

const GENRES = ['Ação', 'Aventura', 'Animação', 'Comédia', 'Crime', 'Drama', 'Fantasia', 'Ficção Científica', 'Horror', 'Mistério', 'Romance', 'Terror', 'Thriller'];

export default function SeriesPage() {
  return <CatalogPage kind="series" title="Séries" base="/series" genres={GENRES} />;
}
