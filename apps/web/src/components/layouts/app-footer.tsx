import { Link } from '@tanstack/react-router';

export function AppFooter() {
  return (
    <footer className="border-t border-border">
      <p className="mx-auto w-full max-w-5xl px-4 py-4 text-xs text-muted-foreground">
        Agenda Unimed · seus dados e os dos seus contatos são tratados conforme a LGPD.{' '}
        <Link to="/privacidade" className="underline underline-offset-2 hover:text-foreground">
          Aviso de privacidade
        </Link>
      </p>
    </footer>
  );
}
