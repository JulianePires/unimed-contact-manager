import { createFileRoute } from '@tanstack/react-router';

import { PrivacyNotice } from '@/features/auth/components/privacy-notice';

export const Route = createFileRoute('/_public/privacidade')({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <>
      <title>Aviso de privacidade · Agenda Unimed</title>
      <h1 className="text-2xl font-semibold">Aviso de privacidade</h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        Como a Agenda Unimed trata os seus dados e os dos seus contatos, conforme a LGPD.
      </p>
      <PrivacyNotice />
    </>
  );
}
