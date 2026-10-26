import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <>
      <title>Agenda Unimed</title>
      <h1 className="text-2xl font-semibold">Agenda Unimed</h1>
    </>
  );
}
