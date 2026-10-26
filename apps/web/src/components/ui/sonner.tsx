import { Toaster as Sonner, type ToasterProps } from 'sonner';

/** Toasts no tema escuro da Agenda Unimed; o texto também é anunciado pelo LiveAnnouncer. */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'border border-border bg-surface-raised text-foreground',
          description: 'text-muted-foreground',
          error: 'border-danger-border',
          success: 'border-primary',
        },
      }}
      {...props}
    />
  );
}
